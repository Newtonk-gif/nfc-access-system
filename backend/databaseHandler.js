// Firebase Database Handler
const { db, firestore, auth } = require('./firebaseConfig');

class DatabaseHandler {
  
  // ===== USER MANAGEMENT =====
  
  /**
   * Create a new user in Firebase Realtime Database
   * @param {string} userId - Unique user ID
   * @param {object} userData - User data object
   */
  async createUser(userId, userData) {
    try {
      await firestore.collection('users').doc(userId).set({
        ...userData,
        createdAt: new Date().toISOString()
      });
      console.log(`User ${userId} created successfully in Firestore`);
      return { success: true, userId };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   */
  async getUser(userId) {
    try {
      const doc = await firestore.collection('users').doc(userId).get();
      if (doc.exists) {
        return doc.data();
      } else {
        console.log(`User ${userId} not found`);
        return null;
      }
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Get all users
   */
  async getAllUsers() {
    try {
      const snapshot = await firestore.collection('users').get();
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {object} updates - Fields to update
   */
  async updateUser(userId, updates) {
    try {
      await firestore.collection('users').doc(userId).set({
        ...updates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`User ${userId} updated successfully in Firestore`);
      return { success: true, userId };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   * @param {string} userId - User ID
   */
  async deleteUser(userId) {
    try {
      // 1. Delete the user document
      await firestore.collection('users').doc(userId).delete();
      
      // 2. Find and delete any NFC tags associated with this user so they can be re-registered
      const tagsSnapshot = await firestore.collection('nfc_tags').where('userId', '==', userId).get();
      if (!tagsSnapshot.empty) {
        const batch = firestore.batch();
        tagsSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      console.log(`User ${userId} and their NFC tags deleted successfully from Firestore`);
      return { success: true, userId };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // ===== NFC TAG MANAGEMENT =====

  /**
   * Register NFC tag to user
   * @param {string} tagUID - NFC tag unique identifier
   * @param {string} userId - User ID
   * @param {object} tagData - Additional tag data
   */
  async registerNFCTag(tagUID, userId, tagData = {}) {
    try {
      await firestore.collection('nfc_tags').doc(tagUID).set({
        userId,
        tagUID,
        registeredAt: new Date().toISOString(),
        active: true,
        ...tagData
      });
      console.log(`NFC tag ${tagUID} registered to user ${userId} in Firestore`);
      return { success: true, tagUID };
    } catch (error) {
      console.error('Error registering NFC tag:', error);
      throw error;
    }
  }

  /**
   * Get NFC tag by UID
   * @param {string} tagUID - NFC tag unique identifier
   */
  async getNFCTag(tagUID) {
    try {
      const doc = await firestore.collection('nfc_tags').doc(tagUID).get();
      if (doc.exists) {
        return doc.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting NFC tag:', error);
      throw error;
    }
  }

  /**
   * Get all NFC tags for a user
   * @param {string} userId - User ID
   */
  async getUserNFCTags(userId) {
    try {
      const snapshot = await firestore.collection('nfc_tags')
        .where('userId', '==', userId)
        .get();
      
      let tags = {};
      if (!snapshot.empty) {
        snapshot.forEach(doc => {
          tags[doc.id] = doc.data();
        });
      }
      return tags;
    } catch (error) {
      console.error('Error fetching user NFC tags:', error);
      throw error;
    }
  }

  /**
   * Deactivate NFC tag
   * @param {string} tagUID - NFC tag unique identifier
   */
  async deactivateNFCTag(tagUID) {
    try {
      await firestore.collection('nfc_tags').doc(tagUID).update({
        active: false,
        deactivatedAt: new Date().toISOString()
      });
      console.log(`NFC tag ${tagUID} deactivated in Firestore`);
      return { success: true, tagUID };
    } catch (error) {
      console.error('Error deactivating NFC tag:', error);
      throw error;
    }
  }

  // ===== ACCESS LOG MANAGEMENT =====

  /**
   * Log access event
   * @param {string} tagUID - NFC tag UID
   * @param {string} location - Entry point location
   * @param {boolean} granted - Whether access was granted
   */
  async logAccessEvent(tagUID, location, granted = true) {
    try {
      const logEntry = {
        tagUID,
        location,
        granted,
        timestamp: new Date().toISOString(),
        userId: null
      };

      // Get user ID from tag
      const tag = await this.getNFCTag(tagUID);
      if (tag) {
        logEntry.userId = tag.userId;
        
        // Fetch user info to populate rich log details for the dashboard
        const user = await this.getUser(tag.userId);
        if (user) {
          logEntry.userName = user.name || null;
          logEntry.phone = user.phone || null;
          logEntry.role = user.role || null;
          logEntry.department = user.department || null;
        }
      }

      // Create log entry with auto-generated ID in Realtime Database
      const newLogRef = db.ref('logs').push();
      await newLogRef.set(logEntry);

      console.log(`Access event logged in RTDB - Tag: ${tagUID}, Location: ${location}, Granted: ${granted}`);
      return { success: true, logId: newLogRef.key };
    } catch (error) {
      console.error('Error logging access event:', error);
      throw error;
    }
  }

  /**
   * Get access logs
   * @param {number} limit - Number of recent logs to fetch
   */
  async getAccessLogs(limit = 50) {
    try {
      const snapshot = await db.ref('logs').get();

      if (snapshot.exists()) {
        let logsArray = Object.values(snapshot.val());
        // Sort descending to show newest logs first
        logsArray.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });
        return logsArray.slice(0, limit);
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching access logs:', error);
      throw error;
    }
  }

  /**
   * Get access logs for a specific user
   * @param {string} userId - User ID
   * @param {number} limit - Number of logs to fetch
   */
  async getUserAccessLogs(userId, limit = 50) {
    try {
      const snapshot = await db.ref('logs')
        .orderByChild('userId')
        .equalTo(userId)
        .limitToLast(limit)
        .get();

      if (snapshot.exists()) {
        return Object.values(snapshot.val()).reverse();
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching user access logs:', error);
      throw error;
    }
  }

  // ===== REAL-TIME LISTENERS =====

  /**
   * Set up real-time listener for access logs
   * @param {function} callback - Callback function to handle new logs
   */
  listenToAccessLogs(callback) {
    try {
      db.ref('logs').on('child_added', (snapshot) => {
        callback(snapshot.val());
      });
      console.log('Real-time listener set up for access logs (RTDB)');
    } catch (error) {
      console.error('Error setting up listener:', error);
      throw error;
    }
  }

  /**
   * Set up real-time listener for user changes
   * @param {string} userId - User ID
   * @param {function} callback - Callback function
   */
  listenToUserChanges(userId, callback) {
    try {
      firestore.collection('users').doc(userId).onSnapshot(doc => {
        if (doc.exists) {
          callback(doc.data());
        }
      });
      console.log(`Real-time listener set up for user ${userId} (Firestore)`);
    } catch (error) {
      console.error('Error setting up user listener:', error);
      throw error;
    }
  }

  /**
   * Remove listener
   * @param {string} path - Database path
   */
  removeListener(path) {
    try {
      db.ref(path).off();
      console.log(`Listener removed for path: ${path}`);
    } catch (error) {
      console.error('Error removing listener:', error);
      throw error;
    }
  }

  // ===== PAYMENT MANAGEMENT =====

  /**
   * Save M-Pesa payment record
   * @param {object} paymentData - Payment data from M-Pesa callback
   */
  async savePayment(paymentData) {
    try {
      const paymentRecord = {
        ...paymentData,
        createdAt: new Date().toISOString()
      };
      
      await firestore.collection('payments').doc(paymentData.transactionId).set(paymentRecord);
      console.log(`Payment ${paymentData.transactionId} saved successfully in Firestore`);
      return { success: true, transactionId: paymentData.transactionId };
    } catch (error) {
      console.error('Error saving payment:', error);
      throw error;
    }
  }

  /**
   * Get all payments
   * @param {number} limit - Number of recent payments to fetch
   */
  async getAllPayments(limit = 50) {
    try {
      const snapshot = await firestore.collection('payments')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      
      if (!snapshot.empty) {
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  /**
   * Get payment by transaction ID
   * @param {string} transactionId - M-Pesa transaction ID
   */
  async getPayment(transactionId) {
    try {
      const doc = await firestore.collection('payments').doc(transactionId).get();
      if (doc.exists) {
        return doc.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting payment:', error);
      throw error;
    }
  }

  // ===== SYSTEM STATUS =====

  /**
   * Listen to Firebase Realtime Database connection status
   */
  checkConnection() {
    db.ref('.info/connected').on('value', (snap) => {
      if (snap.val() === true) {
        console.log('✅ Successfully linked to Firebase Realtime Database (IoT Sync)!');
        console.log('✅ Successfully linked to Firestore (Main Database)!');
      } else {
        console.log('⏳ Connecting to Firebase databases...');
      }
    });
  }
}

module.exports = new DatabaseHandler();
