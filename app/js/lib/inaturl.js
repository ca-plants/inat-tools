export class InatURL {
  /**
   * @param {string|string[]} id
   * @param {"map"|"grid"|"table"} [subview="grid"]
   * @returns {string}
   */
  static getObsIDLink(id, subview = "grid") {
    const url = new URL("https://www.inaturalist.org/observations");
    const idList = typeof id === "string" ? id : id.join(",");
    // Trial and error to find longest list that works; 9308 doesn't.
    if (idList.length >= 9308) {
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
