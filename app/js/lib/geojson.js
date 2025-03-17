export class GJTools {
    /**
     * @template T
     * @param {import("geojson").Feature} feature
     * @param {string} propName
     * @returns {T|undefined}
     */
    static getProperty(feature, propName) {
        if (!feature.properties) {
            return;
        }
        return feature.properties[propName];
    }

    /**
     * @template T
     * @param {import("geojson").Feature} feature
     * @param {string} propName
     * @param {T} [defaultValue]
     * @returns {T}
     */
    static getRequiredProperty(feature, propName, defaultValue) {
        const value = this.getProperty(feature, propName);
        if (value !== undefined) {
            return value;
        }
        if (defaultValue === undefined) {
            throw new Error();
        }
        this.setProperty(feature, propName, defaultValue);
        return defaultValue;
    }

    /**
     * @template T
     * @param {import("geojson").Feature} feature
     * @param {string} propName
     * @param {T} value
     */
    static setProperty(feature, propName, value) {
        if (!feature.properties) {
            feature.properties = {};
        }
        feature.properties[propName] = value;
    }
}
