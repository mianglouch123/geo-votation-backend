class BanService {
    constructor() {
    this.bannedIPs = new Set();
    this.violations = new Map(); // { ip: { count, timestamp } }
    this.MAX_VIOLATIONS = 10;
    this.BAN_DURATION = 24 * 60 * 60 * 1000; // 24 horas
    }
    checkIp(ip) {
     if(this.bannedIPs.has(ip)) {
      return false;
     }
    
    const record = this.violations.get(ip);
    if(record && record.count >= this.MAX_VIOLATIONS) {
     this.bannedIPs.add(ip);
    }
    setTimeout(() => {
      this.bannedIPs.delete(ip);
      this.violations.delete(ip)
      console.log(`🟢 IP ${ip} desbaneada después de 24h`);

    } , this.BAN_DURATION)
    return true;
  }
  registerViolations(ip) {
    const record = this.violations.get(ip) || { count: 0, timestamp: Date.now() };
    record.count += 1;
    this.violations.set(ip, record);
    console.log(`⚠️ Violación ${record.count}/10 para IP ${ip}`);
    if (record.count >= this.MAX_VIOLATIONS) {
      console.log(`🔴 IP ${ip} baneada por 24h`);
    }


  }


}

export const banService = new BanService();
