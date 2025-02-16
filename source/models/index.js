const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../config/config.json')[env];

const db = {};
const sequelize = new Sequelize(config);
const initPromise = sequelize.authenticate().then(async () => {
	const directories = (await fs.promises.readdir(__dirname)).filter(directory => directory.indexOf('.') === -1);

	const promises = directories.map(async directory => {
		const files = (await fs.promises.readdir(path.join(__dirname, directory))).filter(file =>
			file.indexOf('.') !== 0 &&
			file !== basename &&
			file.slice(-3) === '.js' &&
			file.indexOf('.test.js') === -1
		);

		return files.map(file => {
			const model = require(path.join(__dirname, directory, file)).initModel(sequelize);
			db[model.name] = model;
		});
	})
	await Promise.all(promises);

	Object.keys(db).map(modelName => {
		if (db[modelName].associate) {
			db[modelName].associate(db);
		}
	});
	return sequelize;
});

module.exports = {
	...db,
	sequelize: initPromise,
	Sequelize
};
