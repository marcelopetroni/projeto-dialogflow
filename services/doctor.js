import Doctor from '../models/Doctor.js';
import Schedule from '../models/Schedule.js';
import securityUtils from '../utils/security.js';

class DoctorService {
    constructor() {
        this.Doctor = Doctor;
        this.Schedule = Schedule;
    }

    async getAvailableDoctors() {
        return this.Doctor.findAll({
            where: { active: true },
            order: [['name', 'ASC']]
        });
    }

    async getAllAvailableDoctors() {
        const doctors = await this.Doctor.findAll({
            where: {
				active: true
			},
            order: [['name', 'ASC']]
        });

        return doctors.map(doctor => ({
            id: doctor.id,
            name: doctor.name,
            specialty: doctor.specialty,
            email: doctor.email,
            phone: doctor.phone
        }));
    }

    async getDoctorById(id) {
        const doctor = await this.Doctor.findByPk(id);
        if (!doctor) {
            throw new Error('Médico não encontrado');
        }

        return doctor;
    }

    async getDoctorByName(name) {
        const doctor = await this.Doctor.findOne({
            where: {
                name: {
                    [this.Doctor.sequelize.Sequelize.Op.like]: `%${name}%`
                },
                active: true
            }
        });
        return doctor;
    }

    async getDoctorAvailableSchedules(doctorId, date) {
        const doctor = await this.getDoctorById(doctorId);

        const schedules = await this.Schedule.findAll({
            where: {
                doctor_id: doctorId,
                date: date,
                status: 'available'
            },
            order: [['time', 'ASC']]
        });

        return schedules;
    }

    async checkDoctorAvailability(doctorId, date) {
        const availableSchedules = await this.Schedule.count({
            where: {
                doctor_id: doctorId,
                date: date,
                status: 'available'
            }
        });

        return availableSchedules > 0;
    }

    async getAllDoctors() {
        const doctors = await this.Doctor.findAll({
            where: { active: true },
            order: [['name', 'ASC']]
        });

        return doctors;
    }

    async createDoctor(doctorData) {
        const dataToSave = { ...doctorData };
        const originalEmail = dataToSave.email;
        const originalPhone = dataToSave.phone;

        if (dataToSave.email) {
            dataToSave.email = await securityUtils.hashEmail(dataToSave.email);
        }

        if (dataToSave.phone) {
            dataToSave.phone = await securityUtils.hashPhone(dataToSave.phone);
        }

        const doctor = await this.Doctor.create(dataToSave);

        const doctorJson = doctor.get ? doctor.get({ plain: true }) : doctor;
        return {
            ...doctorJson,
            email: originalEmail,
            phone: originalPhone
        };
    }

    async updateDoctor(id, doctorData) {
        const doctor = await this.getDoctorById(id);

        const dataToUpdate = { ...doctorData };
        const originalEmail = dataToUpdate.email;
        const originalPhone = dataToUpdate.phone;

        if (dataToUpdate.email) {
            dataToUpdate.email = await securityUtils.hashEmail(dataToUpdate.email);
        }

        if (dataToUpdate.phone) {
            dataToUpdate.phone = await securityUtils.hashPhone(dataToUpdate.phone);
        }

        await doctor.update(dataToUpdate);
        await doctor.reload();

        const doctorJson = doctor.get ? doctor.get({ plain: true }) : doctor;
        return {
            ...doctorJson,
            email: originalEmail !== undefined ? originalEmail : doctorJson.email,
            phone: originalPhone !== undefined ? originalPhone : doctorJson.phone
        };
    }

    async deleteDoctor(id) {
        const doctor = await this.getDoctorById(id);
        await doctor.update({ active: false });
        return { message: 'Médico desativado com sucesso' };
    }
}

export default DoctorService;