const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

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
		module.exports[model.name] = model;
	});
})
await Promise.all(promises);

Object.keys(module.exports).map(modelName => {
	if (module.exports[modelName].associate) {
		module.exports[modelName].associate(module.exports);
	}
});
