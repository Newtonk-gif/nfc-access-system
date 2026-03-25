// Firebase Database Handler
const { db, auth } = require('./firebaseConfig');

class DatabaseHandler {
  
  // ===== USER MANAGEMENT =====
  
  /**
   * Create a new user in Firebase Realtime Database
   * @param {string} userId - Unique user ID
   * @param {object} userData - User data object
   */
  async createUser(userId, userData) {
    try {
      await db.ref(`users/${userId}`).set({
        ...userData,
        createdAt: new Date().toISOString()
      });
      console.log(`User ${userId} created successfully`);
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
      const snapshot = await db.ref(`users/${userId}`).get();
      if (snapshot.exists()) {
        return snapshot.val();
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
      const snapshot = await db.ref('users').get();
      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        return {};
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
      await db.ref(`users/${userId}`).update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
      console.log(`User ${userId} updated successfully`);
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
      await db.ref(`users/${userId}`).remove();
      console.log(`User ${userId} deleted successfully`);
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
      await db.ref(`nfc_tags/${tagUID}`).set({
        userId,
        tagUID,
        registeredAt: new Date().toISOString(),
        active: true,
        ...tagData
      });
      console.log(`NFC tag ${tagUID} registered to user ${userId}`);
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
      const snapshot = await db.ref(`nfc_tags/${tagUID}`).get();
      if (snapshot.exists()) {
        return snapshot.val();
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
      const snapshot = await db.ref('nfc_tags')
        .orderByChild('userId')
        .equalTo(userId)
        .get();
      
      if (snapshot.exists()) {
        return snapshot.val();
      } else {
        return {};
      }
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
      await db.ref(`nfc_tags/${tagUID}`).update({
        active: false,
        deactivatedAt: new Date().toISOString()
      });
      console.log(`NFC tag ${tagUID} deactivated`);
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

      // Create log entry with auto-generated ID
      const newLogRef = db.ref('access_logs').push();
      await newLogRef.set(logEntry);

      console.log(`Access event logged - Tag: ${tagUID}, Location: ${location}, Granted: ${granted}`);
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
      const snapshot = await db.ref('access_logs')
        .orderByChild('timestamp')
        .limitToLast(limit)
        .get();

      if (snapshot.exists()) {
        return Object.values(snapshot.val()).reverse();
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
      const snapshot = await db.ref('access_logs')
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
      db.ref('access_logs').on('child_added', (snapshot) => {
        callback(snapshot.val());
      });
      console.log('Real-time listener set up for access logs');
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
      db.ref(`users/${userId}`).on('value', (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.val());
        }
      });
      console.log(`Real-time listener set up for user ${userId}`);
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
}

module.exports = new DatabaseHandler();
