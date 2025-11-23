import DoctorService from './doctor.js'
import ScheduleService from './schedule.js'
import moment from 'moment'

class WebhookService {
	constructor() {
		this.doctorService = new DoctorService()
		this.scheduleService = new ScheduleService()
		this.sessionData = new Map()
	}

	setSessionData(session, newData) {
		if (!session) {
			return;
		}

		const existing = this.sessionData.get(session) || {}
		const merged = { ...existing, ...newData }

		this.sessionData.set(session, merged)

		try {
			console.log('[Webhook] setSessionData', { session, keys: Object.keys(merged) })
		} catch {
			return;
		}

	}

	getSessionData(session) {
		const data = this.sessionData.get(session) || {}

		try {
			console.log('[Webhook] getSessionData', { session, keys: Object.keys(data) })
		} catch {
			return;
		}
		return data
	}

	clearSessionData(session) {
		if (!session) {
			return;
		}

		this.sessionData.delete(session)
		try {
			console.log('[Webhook] clearSessionData', { session })
		} catch {
			return;
		}
	}

	getContextParams(requestBody, contextName) {
		const outputContexts = requestBody.queryResult?.outputContexts || [];

		const context = outputContexts.find(ctx =>
			ctx.name.includes(contextName) ||
			ctx.name.includes(contextName.replace('-', '_'))
		);

		return context?.parameters || {};
	}

	async processWebhook(requestBody) {
		try {
			const { queryResult, session } = requestBody

			if (!queryResult) {
				throw new Error('queryResult ausente')
			}

			const intent = queryResult.intent?.displayName || 'Default Fallback Intent'
			const parameters = queryResult.parameters || {}

			const response = await this.handleIntent(intent, parameters, requestBody, session)

			return response
		} catch (error) {
			console.error('Erro no processamento do webhook:', error);
			return { fulfillmentText: `Desculpe, houve um erro ao processar sua solicitação. (${error.message})` }
		}
	}

	async handleIntent(intentName, parameters, requestBody, session) {
		return intentName === 'Listar medicos' ? this.handleListAllDoctors()
			: intentName === 'Listar horarios' ? this.handleGetSchedules(parameters, requestBody, session)
			: intentName === 'Informar nome' ? this.handleInformName(requestBody, session)
			: intentName === 'Informar celular' ? this.handleInformPhone(requestBody, session)
			: intentName === 'Confirmar agendamento' ? this.handleConfirmAttendance(session)
			: intentName === 'Confirmar cancelamento' ? this.handleCancelAppointment(requestBody, session)
			: { fulfillmentText: 'Não entendi sua solicitação.' }
	}

	async handleListAllDoctors() {
		const doctors = await this.doctorService.getAllAvailableDoctors()

		if (!doctors.length) {
			return { fulfillmentText: 'Nenhum médico cadastrado.' }
		}

		return {
			fulfillmentText: `Perfeito! Aqui estão os médicos disponíveis. Digite o número correspondente para escolher:\n\n` +
				doctors.map((d, index) => `${index + 1}. ${d.name} - ${d.specialty}`).join('\n')
		}
	}

	async handleGetSchedules(parameters, requestBody, session) {
		const previous = this.getContextParams(requestBody, "awaiting-schedule");

		if (previous.doctorId) {
			return await this.handleChooseSchedule(parameters, requestBody, session);
		}

		const doctorId = parameters?.number;

		if (!doctorId) {
			return { fulfillmentText: 'Informe o ID do médico.' }
		}

		try {
			const today = moment().format('YYYY-MM-DD');
			const schedules = await this.scheduleService.getAvailableSchedulesByDoctor(doctorId, today)

			if (!schedules.length) {
				return { fulfillmentText: 'Nenhum horário disponível para hoje.' }
			}

			const scheduleList = schedules.map((s, index) => `${index + 1} - ${moment(s.time, 'HH:mm:ss').format('HH:mm')}`).join('\n');

			return {
				fulfillmentText: `Aqui estão os horários disponíveis para hoje, escolha um número para agendar:\n\n${scheduleList}`,
				outputContexts: [
					{
						name: `${session}/contexts/awaiting-schedule`,
						lifespanCount: 3,
						parameters: {
							doctorId,
							scheduleCount: schedules.length
						}
					}
				]
			}
		} catch (error) {
			console.error('Erro ao buscar horários:', error);
			return { fulfillmentText: 'Erro ao buscar os horários disponíveis. Tente novamente.' }
		}
	}

	async handleChooseSchedule(parameters, requestBody, session) {
		const scheduleIndex = parameters?.number - 1;
		const previous = this.getContextParams(requestBody, "awaiting-schedule");

		if (!previous.doctorId) {
			return { fulfillmentText: 'Não foi possível encontrar os dados do médico. Por favor, liste os médicos novamente.' };
		}

		try {
			const today = moment().format('YYYY-MM-DD');
			const schedules = await this.scheduleService.getAvailableSchedulesByDoctor(previous.doctorId, today);
			const selectedSchedule = schedules[scheduleIndex];

			if (!selectedSchedule) {
				return { fulfillmentText: 'Horário inválido. Por favor, escolha um número da lista.' };
			}

			this.setSessionData(session, {
				doctorId: previous.doctorId,
				scheduleId: selectedSchedule.id,
				scheduleTime: selectedSchedule.time,
				scheduleDate: today
			});

			return {
				fulfillmentText: `Perfeito! Você escolheu o horário ${moment(selectedSchedule.time, 'HH:mm:ss').format('HH:mm')}.\n\nAgora, por favor, me informe seu nome completo:`,
				outputContexts: [
					{
						name: `${session}/contexts/awaiting-name`,
						lifespanCount: 3,
						parameters: {
							doctorId: previous.doctorId,
							scheduleId: selectedSchedule.id,
							scheduleTime: selectedSchedule.time
						}
					}
				]
			}
		} catch (error) {
			console.error('Erro ao processar escolha do horário:', error);
			return { fulfillmentText: 'Erro ao processar sua escolha. Tente novamente.' }
		}
	}

	async handleInformName(requestBody, session) {
		const parameters = requestBody.queryResult.parameters;

		const previous = this.getContextParams(requestBody, "awaiting-name");

		const patientName = parameters?.any || parameters?.patient_name || parameters?.person?.name;

		if (!patientName) {
			return { fulfillmentText: 'Por favor, informe seu nome completo.' };
		}

		this.setSessionData(session, {
			patientName
		});

		return {
			fulfillmentText: `Obrigado, ${patientName}! Agora, por favor, me informe seu telefone para contato:`,
			outputContexts: [
				{
					name: `${session}/contexts/awaiting-phone`,
					lifespanCount: 3,
					parameters: {
						doctorId: previous.doctorId,
						scheduleId: previous.scheduleId,
						scheduleTime: previous.scheduleTime,
						patientName
					}
				}
			]
		};
	}

	async handleInformPhone(requestBody, session) {
		const parameters = requestBody.queryResult.parameters;
		const previous = this.getContextParams(requestBody, "awaiting-phone");
		const sessionData = this.getSessionData(session);

		const patientPhone = parameters?.['phone-number'] || parameters?.phone_number || parameters?.any;

		if (!patientPhone) {
			return { fulfillmentText: 'Por favor, informe seu telefone.' };
		}

		this.setSessionData(session, {
			patientPhone
		});

		const scheduleTime = sessionData.scheduleTime || previous.scheduleTime;
		const patientName = sessionData.patientName || previous.patientName;

		return {
			fulfillmentText: `Perfeito! Vamos confirmar seu agendamento:\n\n📅 Data: ${moment().format('DD/MM/YYYY')}\n⏰ Horário: ${moment(scheduleTime, 'HH:mm:ss').format('HH:mm')}\n👤 Nome: ${patientName}\n📞 Telefone: ${patientPhone}\n\nConfirma o agendamento? (Digite "sim" para confirmar)`,
			outputContexts: [
				{
					name: `${session}/contexts/awaiting-confirmation`,
					lifespanCount: 5,
					parameters: {
						doctorId: previous.doctorId,
						scheduleId: previous.scheduleId,
						scheduleTime: previous.scheduleTime,
						patientName: previous.patientName,
						patientPhone
					}
				},
				{
					name: `${session}/contexts/booking-data`,
					lifespanCount: 10,
					parameters: {
						doctorId: previous.doctorId,
						scheduleId: previous.scheduleId,
						scheduleTime: previous.scheduleTime,
						patientName: previous.patientName,
						patientPhone
					}
				}
			]
		};
	}

	async handleConfirmAttendance(session) {
		const sessionData = this.getSessionData(session);

		const data = {
			doctorId: sessionData.doctorId,
			scheduleId: sessionData.scheduleId,
			scheduleTime: sessionData.scheduleTime,
			scheduleDate: sessionData.scheduleDate,
			patientName: sessionData.patientName,
			patientPhone: sessionData.patientPhone,
		};

		if (!data.scheduleId || !data.patientName || !data.patientPhone) {
			return {
				fulfillmentText: 'Dados incompletos para confirmar o agendamento. Por favor, comece novamente.',
				outputContexts: []
			};
		}

		try {
			const result = await this.scheduleService.confirmAppointment(data.scheduleId, {
				patient_name: data.patientName,
				patient_phone: data.patientPhone
			});

			this.clearSessionData(session);

			return {
				fulfillmentText: `✅ Agendamento confirmado com sucesso!\n\n📅 Data: ${moment(result.date).format('DD/MM/YYYY')}\n⏰ Horário: ${moment(result.time, 'HH:mm:ss').format('HH:mm')}\n👤 Paciente: ${data.patientName}\n📞 Telefone: ${data.patientPhone}\n\n🎫 Código do agendamento: ${result.id}.\n\nAté logo!`,
				outputContexts: []
			};
		} catch (error) {
			console.error('Erro ao confirmar agendamento:', error);
			return {
				fulfillmentText: `Desculpe, houve um erro ao confirmar o agendamento: ${error.message}. Por favor, tente novamente.`,
				outputContexts: []
			};
		}
	}

	async handleCancelAppointment(requestBody, session) {
		const parameters = requestBody.queryResult.parameters || {};
		const scheduleId = parameters?.number || parameters?.scheduleId || parameters?.any;

		if (!scheduleId) {
			return {
				fulfillmentText: 'Por favor, informe o ID do agendamento que deseja cancelar.'
			};
		}

		try {
			await this.scheduleService.cancelSchedule(scheduleId);

			this.clearSessionData(session);

			return {
				fulfillmentText: '✅ Agendamento cancelado com sucesso! O horário foi liberado e está disponível novamente.',
				outputContexts: []
			};
		} catch (error) {
			console.error('Erro ao cancelar agendamento:', error);
			return {
				fulfillmentText: `Erro ao cancelar o agendamento: ${error.message}. Tente novamente.`,
				outputContexts: []
			};
		}
	}
}

export default WebhookService
