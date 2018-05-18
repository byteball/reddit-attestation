'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const HttpStatus = require('http-status-codes');
const passport = require('passport');
const RedditStrategy = require('passport-reddit').Strategy;
const db = require('byteballcore/db');
const mutex = require('byteballcore/mutex.js');
const conf = require('byteballcore/conf.js');
const texts = require('./texts');
const notifications = require('./notifications');
const redditData = require('./reddit-data');

passport.use(new RedditStrategy(
	conf.reddit,
	(accessToken, refreshToken, profile, done) => {
		if (
			!profile || 
			!profile.provider || profile.provider !== 'reddit'
		) {
			return done( new Error(400) );
		}

		done(null, profile);
	}
));

const app = express();

app.use(passport.initialize());
// app.use(passport.session());

app.get('/auth', (req, res, next) => {
	const state = req.query.state;
	console.log('auth', state);
	checkIncomingState(state, (err) => {
		if (err) {
			return next(err);
		}

		passport.authenticate('reddit', {state})(req, res, next);
	});
});

app.get('/auth/callback', (req, res, next) => {
	const state = req.query.state;
	const error = req.query.error;
	console.log('auth callback', state, error);
	if (error) {
		return next( new Error(422) );
	}
	checkIncomingState(state, (err, row) => {
		if (err) {
			return next(err);
		}

		passport.authenticate('reddit', (err, user, info) => {
			if (err) {
				return next(err);
			}

			function checkAndGetRedditUserId() {
				return new Promise((resolve, reject) => {
					db.query(
						`SELECT 
							*
						FROM reddit_users
						WHERE reddit_user_id=?`,
						[user.id],
						(rows) => {
							if (!rows.length) {
								return db.query(
									`INSERT INTO reddit_users
									(reddit_user_id, reddit_name, reddit_karma, reddit_created)
									VALUES(?,?,?,?)`,
									[user.id, user.name, userKarma, userCreated],
									(res) => {
										resolve({reddit_user_id: user.id, status: 'new'});
									}
								);
							}
		
							const row = rows[0];
							const reddit_user_id = row.reddit_user_id;
							if (row.reddit_karma !== userKarma) {
								db.query(
									`UPDATE reddit_users
									SET reddit_karma=?
									WHERE reddit_user_id=?`,
									[userKarma, reddit_user_id],
									(res) => {
										resolve({reddit_user_id, status: 'update'});
									}
								);
							} else {
								resolve({reddit_user_id, status: 'old'});
							}
						}
					);
				});
			}

			const userCreated = new Date(user._json.created_utc * 1000);
			const userKarma = user.link_karma + user.comment_karma;

			const device = require('byteballcore/device.js');
			checkAndGetRedditUserId()
				.then(({reddit_user_id, status}) => {
					res.send(`Received grant access to your Reddit account: ${user.name}`).end();

					if (status !== 'new' && row.reddit_user_id === reddit_user_id) {
						return device.sendMessageToDevice(row.device_address, 'text', 
							texts.usedTheSameRedditAccount(user.name) +
							(status === 'update' ? ('\n\n' + texts.receiveRewardInUSD(redditData.getRewardInUSDByKarma(userKarma)) ) : '') + 
							(!row.user_address ? ('\n\n' + texts.insertMyAddress() ) : '')
						);
					}
		
					mutex.lock([row.device_address], (unlock) => {
						db.query(
							`UPDATE users SET reddit_user_id=? WHERE device_address=?`,
							[reddit_user_id, row.device_address],
							() => {
								device.sendMessageToDevice(row.device_address, 'text', 
									texts.gaveAccessRedditAccount(user.name) + '\n\n' +
									texts.receiveRewardInUSD(redditData.getRewardInUSDByKarma(userKarma)) +
									(!row.user_address ? ('\n\n' + texts.insertMyAddress()) : '')
								);
								unlock();
							}
						);
					});
				})
				.catch(next);
		})(req, res, next);
	});
});

app.use((err, req, res, next) => {
	console.error(err.stack);
	console.error('SERVER CATCH', err.message, err.status);
	let status = parseInt(err.message);
	if (err.message === 'failed to fetch user profile') {
		status = 401;
	}
	if (Number.isNaN(status)) {
		status = 500;
		notifications.notifyAdmin('server error', err.toString());
	}
	res.status(status).send(HttpStatus.getStatusText(status));
});

function checkIncomingState(state, cb) {
	if (!state) {
		return cb( new Error(422) );
	}

	db.query(
		`SELECT * FROM users WHERE device_address = ?`,
		[state],
		(rows) => {
			if (!rows.length) {
				return cb( new Error(400) );
			}

			cb(null, rows[0]);
		}
	);
}

exports.start = () => {

	app.listen(conf.web.port,  () => {
		console.log(`== server start listen on ${conf.web.port} port`);
	});
};

exports.checkConfig = (error = '') => {
	if (
		!conf.reddit ||
		!conf.reddit.clientID || !conf.reddit.clientSecret || !conf.reddit.callbackURL
	) {
		error += '';
	}
	return error;
};