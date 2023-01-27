'use strict';

const {exec} = require('child_process');
const path = require('path')
const {platform} = require('os')
const StatusInterface = require('../model/status/Interface');
const StatusPeer = require('../model/status/Peer');
const ConfigInterface = require('../model/config/Interface');
const ConfigPeer = require('../model/config/Peer');

class Wg {
	commands = {
		'win32': 'wg.exe',
		'linux': 'wg',
		'darwin': 'wg'
	}

	constructor(pathToBinary = '') {
		this.path = pathToBinary
	}

	get command() {
		return path.join(this.path, this.commands[platform()])
	}

	show(device){
		if(!device){
			device = 'all';
		}
		return new Promise((resolve, reject) => {
			if(!/^[A-Za-z0-9]*$/.test(device)) {
				return reject("Invalid device/interface name");
			}
			exec(`${this.command} show ${device} dump`, function(error, stdout, stderr){
				if(error){
					return reject(`Exec error: ${error}`);
				}
				if(stderr){
					return reject(`StdErr: ${stderr}`);
				}
				let lines = stdout.split('\n');
				let data = {}, tmp;
				for(let i = 0; i < lines.length; i++){
					// skip empty lines
					if(lines[i].trim() === ''){
						continue;
					}
					let parts = lines[i].split('\t');
					if(device !== 'all'){
						parts.unshift(device);
					}
					if(parts.length === 5){
						tmp = new StatusInterface(parts[0]);
						tmp.privateKey = parts[1];
						tmp.publicKey = parts[2];
						tmp.listenPort = parts[3];
						data[parts[0]] = tmp;
					}
					if(parts.length === 9){
						tmp = new StatusPeer(parts[1]);
						tmp.endpoint = parts[3];
						tmp.allowedIps = parts[4];
						tmp.latestHandshake = parts[5];
						tmp.transferTx = parts[6];
						tmp.transferRx = parts[7];
						tmp.persistentKeepalive = parts[8];
						data[parts[0]].addPeer(tmp);
					}
				}

				resolve(data);
			});
		});
	}

	showconf(device){
		return new Promise((resolve, reject) => {
			if(!device){
				return reject('No device/interface specified');
			}

			if(!/^[A-Za-z0-9]*$/.test(device)) {
				return reject('Invalid device/interface name');
			}
			exec(`${this.command} showconf ${device}`, function(error, stdout, stderr){
				if(error){
					return reject(`Exec error: ${error}`);
				}
				if(stderr){
					return reject(`StdErr: ${stderr}`);
				}

				let lines = stdout.split('\n');
				let iface = new ConfigInterface();
				let currentPeer, parts;
				for(let i = 0; i < lines.length; i++){
					if(lines[i].trim() === '[Interface]'){
						currentPeer = null;
						continue;
					}
					if(lines[i].trim() === '[Peer]'){
						currentPeer = new ConfigPeer();
						iface.addPeer(currentPeer);
						continue;
					}

					parts = lines[i].split('=');
					if(parts.length < 2){
						continue;
					}

					if(currentPeer){
						currentPeer.set(parts[0], parts[1].trim());
					}else{
						iface.set(parts[0], parts[1].trim());
					}
				}

				resolve(iface);
			});
		});
	}

	genkey(){
		return new Promise((resolve, reject) => {
			exec(`${this.command} genkey`, function(error, stdout, stderr){
				if(error){
					return reject(`Exec error: ${error}`);
				}
				if(stderr){
					return reject(`StdErr: ${stderr}`);
				}

				resolve(stdout.trim());
			});
		});
	}

	genpsk(){
		return new Promise((resolve, reject) => {
			exec(`${this.command} genpsk`, function(error, stdout, stderr){
				if(error){
					return reject(`Exec error: ${error}`);
				}
				if(stderr){
					return reject(`StdErr: ${stderr}`);
				}

				resolve(stdout.trim());
			});
		});
	}

	pubkey(privateKey){
		return new Promise((resolve, reject) => {
			if(!/^[A-Za-z0-9+/=]*$/.test(privateKey)){
				return reject('Invalid private key');
			}
			
			exec(`echo ${privateKey} | ${this.command} pubkey`, function(error, stdout, stderr){
				if(error){
					return reject(`Exec error: ${error}`);
				}
				if(stderr){
					return reject(`StdErr: ${stderr}`);
				}

				resolve(stdout.trim());
			});
		});
	}

}

module.exports = Wg;
