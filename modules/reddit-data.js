
const conf = require('byteballcore/conf');
const db = require('byteballcore/db');

/**
 * get reddit user data by reddit_user_id
 * @param {number} id
 * @param {function} cb
 */
exports.getRedditUserDataById = (id, cb) => {
	db.query(
		`SELECT *
		FROM reddit_users
		WHERE reddit_user_id=?`,
		[id],
		(rows) => {
			cb(rows[0]);
		}
	);
};

/**
 * get count of usd by reddit account karma value
 * @param {number} karma
 * @return {number}
 */
exports.getRewardInUSDByKarma = (karma) => {
	let reward = 0;
	conf.arrRedditKarmaRewardsInUsd.forEach((row) => {
		if (karma > row.threshold && 
				reward < row.rewardInUsd) {
			reward = row.rewardInUsd;
		}
	});
	return reward;
};