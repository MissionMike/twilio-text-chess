const responseData = require("../data/data-responses.js");

/**
 * Function to help determine if a provided text value matches any acceptible
 * interpreted values
 *
 * @param {string} target the interpreted value we're trying to match
 * @param {string} providedText the text provided to interpreter
 */
module.exports = function (target = "", providedText = "") {
	target = target.toLowerCase();
	providedTextClean = providedText
		.toLowerCase()
		.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
		.trim();

	if (!responseData[target]) {
		return false;
	}
	return responseData[target].includes(providedTextClean);
};
