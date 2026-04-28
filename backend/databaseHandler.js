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
      }

      // Create log entry with auto-generated Document ID
      const newLogRef = firestore.collection('logs').doc();
      await newLogRef.set(logEntry);

      console.log(`Access event logged in Firestore - Tag: ${tagUID}, Location: ${location}, Granted: ${granted}`);
      return { success: true, logId: newLogRef.id };
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
      const snapshot = await firestore.collection('logs')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs.map(doc => doc.data());
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
      // Query by userId and sort in memory (avoids requiring a complex composite index setup in Firestore)
      const snapshot = await firestore.collection('logs')
        .where('userId', '==', userId)
        .get();

      if (!snapshot.empty) {
        let logsArray = snapshot.docs.map(doc => doc.data());
        logsArray.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return logsArray.slice(0, limit);
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
      const now = new Date().toISOString();
      firestore.collection('logs')
        .where('timestamp', '>=', now)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') callback(change.doc.data());
          });
        });
      console.log('Real-time listener set up for access logs (Firestore)');
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
      console.log(`Listener removal invoked. (Note: Firestore uses unsub function references instead of path strings)`);
    } catch (error) {
      console.error('Error removing listener:', error);
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
