import bcrypt from 'bcrypt';

class SecurityUtils {
	async hashSensitiveData(data) {
		if (!data) {
			return null;
		}
		const saltRounds = 10;
		return await bcrypt.hash(String(data), saltRounds);
	}

	async compareHash(data, hash) {
		if (!data || !hash) {
			return false;
		}
		return await bcrypt.compare(String(data), hash);
	}

	async hashPhonePartial(phone) {
		if (!phone) {
			return null;
		}
		const phoneStr = String(phone).replace(/\D/g, '');
		if (phoneStr.length < 4) {
			return await this.hashSensitiveData(phone);
		}
		const lastFour = phoneStr.slice(-4);
		const toHash = phoneStr.slice(0, -4);
		const hashed = await this.hashSensitiveData(toHash);
		return hashed ? `${hashed}:${lastFour}` : null;
	}

	async hashPhone(phone) {
		if (!phone) {
			return null;
		}
		return await this.hashSensitiveData(phone);
	}

	async hashName(name) {
		if (!name) {
			return null;
		}
		return await this.hashSensitiveData(name);
	}

	async hashEmail(email) {
		if (!email) {
			return null;
		}
		return await this.hashSensitiveData(email);
	}
}

export default new SecurityUtils();
