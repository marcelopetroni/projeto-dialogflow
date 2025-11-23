import Doctor from '../models/Doctor.js';
import Schedule from '../models/Schedule.js';
import securityUtils from '../utils/security.js';

class ScheduleService {
    constructor() {
        this.Schedule = Schedule;
        this.Doctor = Doctor;
    }

    async getAvailableSchedules(doctorId, date) {
        const schedules = await this.Schedule.findAll({
            where: {
                doctor_id: doctorId,
                date: date,
                status: 'available'
            },
            include: [{
                model: this.Doctor,
                as: 'doctor',
                attributes: ['name', 'specialty']
            }],
            order: [['time', 'ASC']]
        });

        return schedules.map(schedule => ({
            id: schedule.id,
            time: schedule.time,
            doctor: schedule.doctor,
            available: schedule.status === 'available'
        }));
    }

    async getAvailableSchedulesByDoctor(doctorId, date) {
        const schedules = await this.Schedule.findAll({
            where: {
                doctor_id: doctorId,
                date: date,
                status: 'available'
            },
            order: [['time', 'ASC']]
        });

        return schedules.map(schedule => ({
            id: schedule.id,
            time: schedule.time,
            date: schedule.date,
            doctor_id: schedule.doctor_id
        }));
    }

    async bookSchedule(scheduleId, patientData) {
        const schedule = await this.Schedule.findByPk(scheduleId);

        if (!schedule) {
            throw new Error('Horário não encontrado');
        }

        if (schedule.status !== 'available') {
            throw new Error('Horário não está mais disponível');
        }

        const hashedName = patientData.patient_name
            ? await securityUtils.hashName(patientData.patient_name)
            : null;
        const hashedPhone = patientData.patient_phone
            ? await securityUtils.hashPhone(patientData.patient_phone)
            : null;

        await schedule.update({
            status: 'booked',
            patient_name: hashedName,
            patient_phone: hashedPhone,
            booked_at: new Date()
        });

        return {
            id: schedule.id,
            message: 'Agendamento realizado com sucesso',
            appointment: {
                id: schedule.id,
                doctor_id: schedule.doctor_id,
                date: schedule.date,
                time: schedule.time,
                patient_name: patientData.patient_name,
                patient_phone: patientData.patient_phone
            }
        };
    }

    async bookScheduleByTime(doctorId, date, time, patientData) {
        const existingSchedule = await this.Schedule.findOne({
            where: {
                doctor_id: doctorId,
                date: date,
                time: time,
                status: 'available'
            }
        });

        if (!existingSchedule) {
            throw new Error('Horário não está disponível');
        }

        const hashedName = patientData.patient_name
            ? await securityUtils.hashName(patientData.patient_name)
            : null;
        const hashedPhone = patientData.patient_phone
            ? await securityUtils.hashPhone(patientData.patient_phone)
            : null;

        await existingSchedule.update({
            status: 'booked',
            patient_name: hashedName,
            patient_phone: hashedPhone,
            booked_at: new Date()
        });

        return {
            id: existingSchedule.id,
            doctor_id: existingSchedule.doctor_id,
            date: existingSchedule.date,
            time: existingSchedule.time,
            patient_name: patientData.patient_name,
            patient_phone: patientData.patient_phone,
            booked_at: existingSchedule.booked_at
        };
    }

    async confirmAppointment(scheduleId, patientData) {
        const schedule = await this.Schedule.findByPk(scheduleId);

        if (!schedule) {
            throw new Error('Horário não encontrado');
        }

        if (schedule.status !== 'available') {
            throw new Error('Horário não está mais disponível');
        }

        const hashedName = patientData.patient_name
            ? await securityUtils.hashName(patientData.patient_name)
            : null;
        const hashedPhone = patientData.patient_phone
            ? await securityUtils.hashPhone(patientData.patient_phone)
            : null;

        await schedule.update({
            status: 'booked',
            patient_name: hashedName,
            patient_phone: hashedPhone,
            booked_at: new Date()
        });

        return {
            id: schedule.id,
            doctor_id: schedule.doctor_id,
            date: schedule.date,
            time: schedule.time,
            patient_name: patientData.patient_name,
            patient_phone: patientData.patient_phone,
            booked_at: schedule.booked_at,
            message: 'Agendamento confirmado com sucesso'
        };
    }

    async cancelSchedule(scheduleId) {
        const schedule = await this.Schedule.findByPk(scheduleId);

        if (!schedule) {
            throw new Error('Agendamento não encontrado');
        }

        if (schedule.status !== 'booked') {
            throw new Error('Agendamento não está marcado');
        }

        await schedule.update({
            status: 'available',
            patient_name: null,
            patient_phone: null,
            booked_at: null
        });

        return {
            id: scheduleId,
            message: 'Agendamento cancelado com sucesso'
        };
    }

    async getBookedSchedules(doctorId, date) {
        const schedules = await this.Schedule.findAll({
            where: {
                doctor_id: doctorId,
                date: date,
                status: 'booked'
            },
            order: [['time', 'ASC']]
        });

        return schedules;
    }

    async getScheduleById(scheduleId) {
        const schedule = await this.Schedule.findByPk(scheduleId, {
            include: [{
                model: this.Doctor,
                as: 'doctor',
                attributes: ['name', 'specialty']
            }]
        });

        if (!schedule) {
            throw new Error('Horário não encontrado');
        }

        return schedule;
    }

    async createSchedule(scheduleData) {
        const schedule = await this.Schedule.create(scheduleData);
        return schedule;
    }

    async updateSchedule(scheduleId, scheduleData) {
        const schedule = await this.getScheduleById(scheduleId);
        await schedule.update(scheduleData);
        return schedule;
    }

    async deleteSchedule(scheduleId) {
        const schedule = await this.getScheduleById(scheduleId);
        await schedule.destroy();
        return { message: 'Horário removido com sucesso' };
    }
}

export default ScheduleService;