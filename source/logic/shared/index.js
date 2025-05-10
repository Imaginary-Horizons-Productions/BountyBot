/** @param {string} property */
function ascendingByProperty(property) {
	return (a, b) => a[property] - b[property];
}

/** @param {string} property */
function descendingByProperty(property) {
	return (a, b) => b[property] - a[property];
}

module.exports = {
	ascendingByProperty,
	descendingByProperty
};
