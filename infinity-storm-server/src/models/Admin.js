/**
 * Admin.js - Simplified Admin Model
 * 
 * Standalone admin authentication table with minimal fields.
 * No roles, no status, no email - just account_id and password.
 */

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');

class Admin extends Model {
  /**
   * Initialize the Admin model with database connection
   */
  static init(sequelize) {
    return super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique admin identifier'
      },

      account_id: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: {
          name: 'unique_account_id',
          msg: 'Account ID already exists'
        },
        comment: 'Admin account identifier for login'
      },

      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Bcrypt hashed password'
      }
    }, {
      sequelize,
      modelName: 'Admin',
      tableName: 'admins',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['account_id']
        }
      ]
    });
  }

  /**
   * Check if provided password matches the stored hash
   * @param {string} password - Plain text password to check
   * @returns {Promise<boolean>} True if password matches
   */
  async checkPassword(password) {
    try {
      return await bcrypt.compare(password, this.password_hash);
    } catch (error) {
      console.error('Password check error:', error.message);
      return false;
    }
  }

  /**
   * Authenticate an admin by account_id and password
   * @param {string} account_id - Admin account ID
   * @param {string} password - Plain text password
   * @returns {Promise<Admin|null>} Admin instance or null if invalid
   */
  static async authenticate(account_id, password) {
    if (!account_id || !password) {
      return null;
    }

    try {
      const admin = await Admin.findOne({
        where: { account_id }
      });

      if (!admin) {
        return null;
      }

      const isValid = await admin.checkPassword(password);
      return isValid ? admin : null;
    } catch (error) {
      console.error('Admin authentication error:', error.message);
      return null;
    }
  }

  /**
   * Ensure default admin exists (dev setup)
   * Creates admin/admin123 if no admins exist
   */
  static async ensureDefaultAdmin() {
    try {
      const count = await Admin.count();
      
      if (count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await Admin.create({
          account_id: 'admin',
          password_hash: hashedPassword
        });
        
        console.log('✓ Default admin created: admin / admin123');
      } else {
        console.log('✓ Admin account exists');
      }
    } catch (error) {
      console.error('⚠ Failed to ensure default admin:', error.message);
    }
  }

  /**
   * Get safe admin data (no password hash)
   */
  getSafeData() {
    return {
      id: this.id,
      account_id: this.account_id,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Admin;

