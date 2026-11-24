const { sequelize, DataTypes } = require('../db');

const AwbDimension = sequelize.define('AwbDimension', {
  awbId:         { type: DataTypes.INTEGER, allowNull: false },
  awbType:       { type: DataTypes.STRING,  allowNull: false, defaultValue: 'MAWB' },
  rateLineIndex: { type: DataTypes.INTEGER, allowNull: true  }, // Which rate line this dim belongs to (0-based index)
  pieces:        { type: DataTypes.INTEGER, allowNull: true  },
  length:        { type: DataTypes.REAL,    allowNull: true  }, // REAL supports decimals (e.g. 45.5 cm)
  width:         { type: DataTypes.REAL,    allowNull: true  },
  height:        { type: DataTypes.REAL,    allowNull: true  },
  volume:        { type: DataTypes.REAL,    allowNull: true  },
  volumetricWeight: { type: DataTypes.REAL, allowNull: true }, // kg, from the Dimension window (29-Oct-2026)
  cmIn:          { type: DataTypes.STRING,  allowNull: true, defaultValue: 'CM' }, // "CM" or "IN" — normalized to CMT/INH in XML
});

module.exports = AwbDimension;
