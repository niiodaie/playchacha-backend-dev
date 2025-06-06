const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { auth } = require('../config');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: true,
      // Ensure user is at least 18 years old
      isAdult(value) {
        const today = new Date();
        const birthDate = new Date(value);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 18) {
          throw new Error('User must be at least 18 years old');
        }
      }
    }
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  kyc_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  kyc_verification_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  account_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'suspended', 'banned', 'inactive']]
    }
  },
  profile_image_url: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        user.password_hash = await bcrypt.hash(user.password_hash, auth.saltRounds);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash, auth.saltRounds);
      }
    }
  }
});

// Instance method to check password
User.prototype.validPassword = async function(password) {
  return await bcrypt.compare(password, this.password_hash);
};

module.exports = User;

