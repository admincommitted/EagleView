import { sequelize, DataTypes } from '../config/database.js';

// Every status event of an AWB / HAWB, in order. AwbTracking keeps one time per milestone column; this
// table keeps the full history: each FSU received from the airline and each milestone entered by hand, with station,
// flight, pieces and weight, and which customer updates were sent for it.

const AwbTrackingEvent = sequelize.define(
  'AwbTrackingEvent',
  {
    awbNumber: { type: DataTypes.STRING(20), allowNull: false }, // master / airline AWB number (176-12345675)
    hawbNumber: { type: DataTypes.STRING(40), allowNull: true }, // set only for a house's own event
    code: { type: DataTypes.STRING(5), allowNull: false }, // FNA FMA FOH RCS DEP ARR TFD RCF NFD DLV
    eventAt: { type: DataTypes.STRING(30), allowNull: false }, // when it happened (ISO text, as the airline sent it)
    station: { type: DataTypes.STRING(5), allowNull: true },
    flight: { type: DataTypes.STRING(12), allowNull: true },
    pieces: { type: DataTypes.INTEGER, allowNull: true },
    weight: { type: DataTypes.FLOAT, allowNull: true },
    source: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'FSU' }, // FSU | MANUAL
    note: { type: DataTypes.STRING(300), allowNull: true },
    user: { type: DataTypes.STRING(60), allowNull: true },
    notified: { type: DataTypes.TEXT, allowNull: true }, // customer updates sent for this event (text summary)
  },
  {
    indexes: [{ fields: ['awbNumber'] }, { fields: ['hawbNumber'] }],
  },
);

export default AwbTrackingEvent;
