const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class Goats {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/json",
            "Origin": "https://dev.goatsbot.xyz",
            "Referer": "https://dev.goatsbot.xyz/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    async login(rawData) {
        const url = "https://dev-api.goatsbot.xyz/auth/login";
        const userData = JSON.parse(decodeURIComponent(rawData.split('user=')[1].split('&')[0]));
        
        try {
            const response = await axios.post(url, {}, { 
                headers: {
                    ...this.headers,
                    'Rawdata': rawData
                }
            });

            if (response.status === 201) {
                const { age, balance } = response.data.user;
                const accessToken = response.data.tokens.access.token;
                return { 
                    success: true,
                    data: { age, balance, accessToken },
                    userData
                };
            } else {
                return { success: false, error: 'Login failed' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getMissions(accessToken) {
        const url = "https://api-mission.goatsbot.xyz/missions/user";
        try {
            const response = await axios.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 200) {
                const missions = {
                    special: [],
                    regular: []
                };
                
                Object.keys(response.data).forEach(category => {
                    response.data[category].forEach(mission => {
                        if (category === 'SPECIAL MISSION') {
                            missions.special.push(mission);
                        } 
                        else if (mission.status === false) {
                            missions.regular.push(mission);
                        }
                    });
                });
                return { success: true, missions };
            }
            return { success: false, error: 'Failed to get missions' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async completeMission(mission, accessToken) {
        if (mission.type === 'Special') {
            const now = DateTime.now().toUnixInteger();
            
            if (mission.next_time_execute && now < mission.next_time_execute) {
                const timeLeft = mission.next_time_execute - now;
                this.log(`Nhiệm vụ ${mission.name} đang trong thời gian chờ: ${timeLeft} giây`, 'warning');
                return false;
            }
        }

        const url = `https://dev-api.goatsbot.xyz/missions/action/${mission._id}`;
        try {
            const response = await axios.post(url, {}, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.status === 201;
        } catch (error) {
            return false;
        }
    }

    async handleMissions(accessToken) {
        const missionsResult = await this.getMissions(accessToken);
        if (!missionsResult.success) {
            this.log(`Không thể lấy danh sách nhiệm vụ: ${missionsResult.error}`, 'error');
            return;
        }

        const { special, regular } = missionsResult.missions;

        for (const mission of special) {
            this.log(`Đang xử lý nhiệm vụ đặc biệt: ${mission.name}`, 'info');
            const result = await this.completeMission(mission, accessToken);
            
            if (result) {
                this.log(`Làm nhiệm vụ ${mission.name} thành công | Phần thưởng: ${mission.reward}`, 'success');
            } else {
                this.log(`Làm nhiệm vụ ${mission.name} thất bại`, 'error');
            }
        }

        for (const mission of regular) {
            const result = await this.completeMission(mission, accessToken);
            if (result) {
                this.log(`Làm nhiệm vụ ${mission.name} thành công | Phần thưởng: ${mission.reward}`, 'success');
            } else {
                this.log(`Làm nhiệm vụ ${mission.name} thất bại`, 'error');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async getCheckinInfo(accessToken) {
        const url = "https://api-checkin.goatsbot.xyz/checkin/user";
        try {
            const response = await axios.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 200) {
                return { 
                    success: true, 
                    data: response.data 
                };
            }
            return { success: false, error: 'Failed to get check-in info' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async performCheckin(checkinId, accessToken) {
        const url = `https://api-checkin.goatsbot.xyz/checkin/action/${checkinId}`;
        try {
            const response = await axios.post(url, {}, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.status === 201;
        } catch (error) {
            return false;
        }
    }

    async handleCheckin(accessToken) {
        try {
            const checkinInfo = await this.getCheckinInfo(accessToken);
            
            if (!checkinInfo.success) {
                this.log(`Không thể lấy thông tin điểm danh: ${checkinInfo.error}`, 'error');
                return;
            }

            const { result, lastCheckinTime } = checkinInfo.data;
            const currentTime = Date.now();
            const timeSinceLastCheckin = currentTime - lastCheckinTime;
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (timeSinceLastCheckin < twentyFourHours) {
                this.log(`Chưa đủ 24 giờ từ lần điểm danh cuối cùng`, 'warning');
                return;
            }

            const nextCheckin = result.find(day => !day.status);
            if (!nextCheckin) {
                this.log(`Đã hoàn thành tất cả các ngày điểm danh`, 'custom');
                return;
            }

            const checkinResult = await this.performCheckin(nextCheckin._id, accessToken);
            if (checkinResult) {
                this.log(`Điểm danh ngày ${nextCheckin.day} thành công | Phần thưởng: ${nextCheckin.reward}`, 'success');
            } else {
                this.log(`Điểm danh ngày ${nextCheckin.day} thất bại`, 'error');
            }
        } catch (error) {
            this.log(`Lỗi xử lý điểm danh: ${error.message}`, 'error');
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initData = data[i];
                const userData = JSON.parse(decodeURIComponent(initData.split('user=')[1].split('&')[0]));
                const userId = userData.id;
                const firstName = userData.first_name;
                
                console.log(`========== Tài khoản ${i + 1} | ${firstName.green} ==========`);
                
                const loginResult = await this.login(initData);
                
                if (loginResult.success) {
                    const { age, balance, accessToken } = loginResult.data;
                    
                    this.log(`Đăng nhập thành công!`, 'success');
                    this.log(`Age: ${age}`, 'custom');
                    this.log(`Balance: ${balance}`, 'custom');

                    await this.handleCheckin(accessToken);
                    await this.handleMissions(accessToken);
                } else {
                    this.log(`Đăng nhập thất bại: ${loginResult.error}`, 'error');
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            await this.countdown(60);
        }
    }
}

const client = new Goats();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});