import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Schedule = sequelize.define('Schedule', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    doctor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'doctors',
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    patient_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    patient_phone: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('available', 'booked', 'cancelled'),
        defaultValue: 'available'
    },
    booked_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'schedules',
    timestamps: true
});

export default Schedule;
