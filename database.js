const { Sequelize } = require('sequelize');

exports.database = new Sequelize({
	dialect: "sqlite",
	storage: "./db.sqlite",
});

exports.database.authenticate().then(() => {
	require('./source/models/guilds/Guild.js').initModel(exports.database);

	require('./source/models/users/User.js').initModel(exports.database);
	require('./source/models/users/Hunter.js').initModel(exports.database);

	exports.database.sync();
})
