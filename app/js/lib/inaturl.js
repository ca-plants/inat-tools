export class InatURL {
    /**
     * @param {string} login
     * @returns {string}
     */
    static getUserLink(login) {
        return `https://www.inaturalist.org/people/${login}`;
    }
}
