export class InatURL {
    /**
     * @param {string|string[]} id
     * @param {"map"|"grid"|"list"} [subview="grid"]
     * @returns {string}
     */
    static getObsIDLink(id, subview = "grid") {
        const url = new URL("https://www.inaturalist.org/observations");
        const idList = typeof id === "string" ? id : id.join(",");
        if (idList.length >= 10813) {
            return "";
        }
        url.searchParams.set("subview", subview);
        url.searchParams.set("id", idList);
        return url.toString();
    }

    /**
     * @param {string} login
     * @returns {string}
     */
    static getUserLink(login) {
        return `https://www.inaturalist.org/people/${login}`;
    }
}
