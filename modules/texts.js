/*jslint node: true */
'use strict';
const desktopApp = require('byteballcore/desktop_app.js');
const conf = require('byteballcore/conf');

/**
 * responses for clients
 */
exports.greeting = () => {
	return [
		"Here you can attest your Reddit account.\n\n",

		`The price of attestation is ${conf.priceInBytes/1e9} GB. `,
		"The payment is nonrefundable even if the attestation fails for any reason.\n\n",

		'You need to grant access to your Reddit account data.\n\n',

		`After you successfully complete attestation for the first time, `,
		`you receive a reward in Bytes depending on your Reddit account karma.`
	].join('');
};

exports.receiveRewardInUSD = (rewardInUSD) => {
	return [
		`After you successfully complete attestation for the first time, `,
		`you receive a $${rewardInUSD.toLocaleString([], {minimumFractionDigits: 2})} reward in Bytes.`
	].join('');
}

exports.weHaveReferralProgram = () => {
	return [
		"Remember, we have a referral program: ",
		"if you send Bytes from your attested address to a new user who is not attested yet, ",
		"and he/she uses those Bytes to pay for a successful attestation, ",
		`you receive a reward in Bytes depending on his/her Reddit account karma.`
	].join('');
};

exports.allowAccessToRedditAccount = (state) => {
	return [
		`Please, click the URL: ${conf.redditAuthURL}?state=${state}\n`,
		'To grant access to your Reddit account data.',
	].join('');
};

exports.usedTheSameRedditAccount = (name) => {
	return `You are already using the Reddit account: ${name}`;
};

exports.gaveAccessRedditAccount = (name) => {
	return [
		`Received grant access to your Reddit account: ${name}\n`, 
		'It will be used for attestation.'
	].join('');
};

exports.insertMyAddress = () => {
	return [
		"Please, send me your address that you wish to attest (click ... and Insert my address).\n",
		"Make sure you are in a single-address wallet. ",
		"If you don't have a single-address wallet, ",
		"please add one (burger menu, add wallet) and fund it with the amount sufficient to pay for the attestation."
	].join('');
};

exports.goingToAttestAddress = (address) => {
	return `Thanks, going to attest your BB address: ${address}.`;
};

exports.privateOrPublic = () => {
	return [
		"Store your Reddit account data privately in your wallet (recommended) or post it publicly?\n\n",
		"[private](command:private)\t[public](command:public)"
	].join('');
};

exports.privateChoose = () => {
	return [
		"Your Reddit account data will be kept private and stored in your wallet.\n",
		"Click [public](command:public) now if you changed your mind."
	].join('');
};

exports.publicChoose = () => {
	return [
		"Your Reddit account data will be posted into the public database and will be available for everyone.\n",
		"Click [private](command:private) now if you changed your mind."
	].join('');
};

exports.pleasePayOrPrivacy = (receivingAddress, price, postPublicly) => {
	return (postPublicly === null) ? exports.privateOrPublic() : exports.pleasePay(receivingAddress, price);
};

exports.pleasePay = (receivingAddress, price, user_address) => {
	return `Please pay for the attestation: [attestation payment](byteball:${receivingAddress}?amount=${price}&single_address=single${user_address}).`;
};

exports.switchToSingleAddress = () => {
	return [
		"Make sure you are in a single-address wallet, ",
		"otherwise switch to a single-address wallet or create one and send me your address before paying."
	].join('');
};

exports.receivedYourPayment = (amount) => {
	return `Received your payment of ${(amount/1e9)} GB, waiting for confirmation. It should take 5-10 minutes.`;
};

exports.paymentIsConfirmed = () => {
	return "Your payment is confirmed.";
};

exports.inAttestation = () => {
	return `You are in attestation. Please wait.`;
};

exports.attestedSuccessFirstTimeBonus = (rewardInUSD, rewardInBytes) => {
	return [
		"You requested an attestation for the first time and will receive a welcome bonus ",
		`of $${rewardInUSD.toLocaleString([], {minimumFractionDigits: 2})} `,
		`(${(rewardInBytes/1e9).toLocaleString([], {maximumFractionDigits: 9})} GB) `,
		"from Byteball distribution fund."
	].join('');
};

exports.referredUserBonus = (referralRewardInUSD, referralRewardInBytes) => {
	return [
		"You referred a user who has just verified his identity and you will receive a reward ",
		`of $${referralRewardInUSD.toLocaleString([], {minimumFractionDigits: 2})} `,
		`(${(referralRewardInBytes/1e9).toLocaleString([], {maximumFractionDigits: 9})} GB) `,
		"from Byteball distribution fund.\n",
		"Thank you for bringing in a new byteballer, the value of the ecosystem grows with each new user!"
	].join('');
};

exports.alreadyAttested = (attestationDate) => {
	return `You were already attested at ${attestationDate} UTC. Attest [again](command: again)?`;
};

exports.currentAttestationFailed = () => {
	return "Your attestation failed. Try [again](command: again)?";
};
exports.previousAttestationFailed = () => {
	return "Your previous attestation failed. Try [again](command: again)?";
};


/**
 * errors initialize bot
 */
exports.errorInitSql = () => {
	return "please import db.sql file\n";
};

exports.errorConfigSmtp = () => {
	return `please specify smtpUser, smtpPassword and smtpHost in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};

exports.errorConfigEmail = () => {
	return `please specify admin_email and from_email in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};

exports.errorConfigSalt = () => {
	return `please specify salt in your ${desktopApp.getAppDataDir()}/conf.json\n`;
};

exports.errorConfigVerifyInvestorToken = () => {
	return `please specify verifyInvestorApiToken and verifyInvestorUserAuthorizationToken in your ${desktopApp.getAppDataDir()}/conf.json`;
};