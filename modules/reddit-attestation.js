/*jslint node: true */
'use strict';
const conf = require('ocore/conf');
const objectHash = require('ocore/object_hash.js');
const db = require('ocore/db');
const constants = require('ocore/constants');
const notifications = require('./notifications');
const texts = require('./texts');
const redditData = require('./reddit-data');

var bJsonBased = (constants.version !== constants.versionWithoutTimestamp);

function retryPostingAttestations() {
	db.query(
		`SELECT 
			transaction_id, 
			user_address, reddit_user_id, post_publicly
		FROM attestation_units
		JOIN transactions USING(transaction_id)
		JOIN receiving_addresses USING(receiving_address)
		WHERE attestation_unit IS NULL AND post_publicly=0`,
		(rows) => {
			rows.forEach((row) => {

				redditData.getRedditUserDataById(row.reddit_user_id, (reddit_user_data) => {
					let	[attestation, src_profile] = getAttestationPayloadAndSrcProfile(
						row.user_address,
						reddit_user_data,
						row.post_publicly
					);
					postAndWriteAttestation(row.transaction_id, exports.redditAttestorAddress, attestation, src_profile);
				});
				
			});
		}
	);
}

function postAndWriteAttestation(transaction_id, attestor_address, attestation_payload, src_profile, callback) {
	if (!callback) callback = function () {};
	const mutex = require('ocore/mutex.js');
	mutex.lock(['tx-'+transaction_id], (unlock) => {
		db.query(
			`SELECT device_address, attestation_date
			FROM attestation_units
			JOIN transactions USING(transaction_id)
			JOIN receiving_addresses USING(receiving_address)
			WHERE transaction_id=?`,
			[transaction_id],
			(rows) => {
				let row = rows[0];
				if (row.attestation_date) { // already posted
					callback(null, null);
					return unlock();
				}

				postAttestation(attestor_address, attestation_payload, (err, unit) => {
					if (err) {
						callback(err);
						return unlock();
					}

					db.query(
						`UPDATE attestation_units 
						SET attestation_unit=?, attestation_date=${db.getNow()}
						WHERE transaction_id=?`,
						[unit, transaction_id],
						() => {
							let device = require('ocore/device.js');
							let explorer = (process.env.testnet ? 'https://testnetexplorer.obyte.org/#' : 'https://explorer.obyte.org/#');
							let text = "Now your Reddit account is attested, see the attestation unit: "+ explorer + unit;

							if (src_profile) {
								let private_profile = {
									unit: unit,
									payload_hash: objectHash.getBase64Hash(attestation_payload, bJsonBased),
									src_profile: src_profile
								};
								let base64PrivateProfile = Buffer.from(JSON.stringify(private_profile)).toString('base64');
								text += "\n\nClick here to save the profile in your wallet: [private profile](profile:"+base64PrivateProfile+"). " +
									"You will be able to use it to access the services that require a proven Reddit account data.";
							}

							text += "\n\n" + texts.weHaveReferralProgram();
							device.sendMessageToDevice(row.device_address, 'text', text);
							callback(null, unit);
							unlock();
						}
					);
				});
			}
		);
	});
}

function postAttestation(attestor_address, payload, onDone) {
	function onError(err) {
		console.error("attestation failed: " + err);
		let balances = require('ocore/balances');
		balances.readBalance(attestor_address, (balance) => {
			console.error('balance', balance);
			notifications.notifyAdmin('attestation failed', err + ", balance: " + JSON.stringify(balance));
		});
		onDone(err);
	}

	let network = require('ocore/network.js');
	let composer = require('ocore/composer.js');
	let headlessWallet = require('headless-obyte');
	let objMessage = {
		app: "attestation",
		payload_location: "inline",
		payload_hash: objectHash.getBase64Hash(payload, bJsonBased),
		payload: payload
	};

	let params = {
		paying_addresses: [attestor_address],
		outputs: [{address: attestor_address, amount: 0}],
		messages: [objMessage],
		signer: headlessWallet.signer,
		callbacks: composer.getSavingCallbacks({
			ifNotEnoughFunds: onError,
			ifError: onError,
			ifOk: (objJoint) => {
				// console.error('ifOk');
				// console.error(objJoint);
				network.broadcastJoint(objJoint);
				onDone(null, objJoint.unit.unit);
			}
		})
	};
	if (conf.bPostTimestamp && attestor_address === exports.redditAttestorAddress) {
		let timestamp = Date.now();
		let dataFeed = {timestamp};
		let objTimestampMessage = {
			app: "data_feed",
			payload_location: "inline",
			payload_hash: objectHash.getBase64Hash(dataFeed),
			payload: dataFeed
		};
		params.messages.push(objTimestampMessage);
	}
	composer.composeJoint(params);
}

function getUserId(profile) {
	const shortProfile = {
		reddit_username: profile.reddit_username,
	};
	return objectHash.getBase64Hash([shortProfile, conf.salt]);
}

function getAttestationPayloadAndSrcProfile(user_address, data, bPublic) {
	let profile = {
		reddit_username: String(data.reddit_username).toLowerCase(),
		karma: String(data.reddit_karma),
		created: String(data.reddit_created)
	};
	if (bPublic) {
		profile.user_id = getUserId(profile);
		let attestation = {
			address: user_address,
			profile: profile
		};
		return [attestation, null];
	}  else {
		let [public_profile, src_profile] = hideProfile(profile);
		let attestation = {
			address: user_address,
			profile: public_profile
		};
		return [attestation, src_profile];
	}
}

function hideProfile(profile) {
	let composer = require('ocore/composer.js');
	let hidden_profile = {};
	let src_profile = {};

	for (let field in profile) {
		if (!profile.hasOwnProperty(field)) continue;
		let value = profile[field];
		let blinding = composer.generateBlinding();
		// console.error(`hideProfile: ${field}, ${value}, ${blinding}`);
		let hidden_value = objectHash.getBase64Hash([value, blinding], bJsonBased);
		hidden_profile[field] = hidden_value;
		src_profile[field] = [value, blinding];
	}
	let profile_hash = objectHash.getBase64Hash(hidden_profile, bJsonBased);
	let user_id = getUserId(profile);
	let public_profile = {
		profile_hash: profile_hash,
		user_id: user_id
	};
	return [public_profile, src_profile];
}

exports.redditAttestorAddress = null;
exports.getAttestationPayloadAndSrcProfile = getAttestationPayloadAndSrcProfile;
exports.postAndWriteAttestation = postAndWriteAttestation;
exports.retryPostingAttestations = retryPostingAttestations;
