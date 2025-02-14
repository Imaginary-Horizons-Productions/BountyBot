const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../config/config.json')[env];

const db = {
	sequelize: new Sequelize(config),
	Sequelize
};

fs.readdirSync(__dirname)
	.filter(directory => {
		return directory.indexOf('.') === -1;
	}).forEach(directory => {
		fs.readdirSync(path.join(__dirname, directory)).filter(file => {
			return (
				file.indexOf('.') !== 0 &&
				file !== basename &&
				file.slice(-3) === '.js' &&
				file.indexOf('.test.js') === -1
			);
		}).forEach(file => {
			const model = require(path.join(__dirname, directory, file)).initModel(db.sequelize);
			db[model.name] = model;
		})
	});

Object.keys(db).forEach(modelName => {
	if (db[modelName].associate) {
		db[modelName].associate(db);
	}
});

module.exports = db;
