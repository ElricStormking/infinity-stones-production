/**
 * Seed Admin User Script
 * Creates a default admin user for testing the admin panel
 */

const { Sequelize } = require('sequelize');
const bcrypt = require('bcrypt');

// Use the same database configuration as the server
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'postgres',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  logging: console.log,
  define: {
    timestamps: true,
    underscored: true
  }
});

// Simple Player model definition
const Player = sequelize.define('Player', {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  },
  username: {
    type: Sequelize.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: Sequelize.STRING(255),
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: Sequelize.STRING(255),
    allowNull: false
  },
  credits: {
    type: Sequelize.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1000.00
  },
  is_demo: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  is_admin: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  last_login_at: {
    type: Sequelize.DATE,
    allowNull: true
  },
  status: {
    type: Sequelize.ENUM('active', 'suspended', 'banned'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'players',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (player) => {
      if (player.password_hash && !player.password_hash.startsWith('$2b$')) {
        player.password_hash = await bcrypt.hash(player.password_hash, 12);
      }
    }
  }
});

async function seedAdminUser() {
  try {
    console.log('🌱 Seeding admin user...');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync the model
    await Player.sync();
    console.log('✅ Player table synced');

    // Check if admin already exists
    const existingAdmin = await Player.findOne({
      where: {
        username: 'admin'
      }
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');

      // Update to ensure admin privileges
      await existingAdmin.update({
        is_admin: true,
        status: 'active'
      });

      console.log('✅ Existing admin user updated');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Admin: ${existingAdmin.is_admin}`);
      console.log(`   Status: ${existingAdmin.status}`);
    } else {
      // Create new admin user
      const adminUser = await Player.create({
        username: 'admin',
        email: 'admin@infinitystorm.dev',
        password_hash: 'admin123', // Will be hashed by the hook
        credits: 10000.00,
        is_demo: false,
        is_admin: true,
        status: 'active'
      });

      console.log('🎉 Admin user created successfully!');
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Username: ${adminUser.username}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Credits: ${adminUser.credits}`);
      console.log(`   Admin: ${adminUser.is_admin}`);
      console.log(`   Status: ${adminUser.status}`);
    }

    // Create a regular test user as well
    const existingTestUser = await Player.findOne({
      where: {
        username: 'testuser'
      }
    });

    if (!existingTestUser) {
      const testUser = await Player.create({
        username: 'testuser',
        email: 'test@infinitystorm.dev',
        password_hash: 'test123',
        credits: 1000.00,
        is_demo: false,
        is_admin: false,
        status: 'active'
      });

      console.log('👤 Test user created successfully!');
      console.log(`   Username: ${testUser.username}`);
      console.log(`   Email: ${testUser.email}`);
    } else {
      console.log('👤 Test user already exists');
    }

    console.log('\n🚀 You can now log in to the admin panel:');
    console.log('   URL: http://localhost:3000/admin');
    console.log('   Username: admin');
    console.log('   Password: admin123');

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the seed function
seedAdminUser();