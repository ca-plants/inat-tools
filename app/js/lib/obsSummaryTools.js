import { INatAPI } from "./inatapi.js";
import { INatObservation } from "./inatobservation.js";
/**
 * @typedef {{
 * name:string,
 * is_branch:boolean,
 * taxon_id:number,
 * parent_id:number,
 * ancestor_ids:number[],
 * displayName:string,
 * rank:string,
 * count:number,countObscured:number,countPublic:number,countResearchGrade:number}} SummaryEntry
 */

/**
 * @param {INatData.Observation[]} rawResults
 * @param {INatAPI} api
 * @returns {Promise<SummaryEntry[]>}
 */
export async function summarizeObservations(rawResults, api) {
    /** @type {Map<string,SummaryEntry>} */
    const summaries = new Map();

    for (const result of rawResults) {
        if (!result.taxon) {
            continue;
        }
        const name = INatAPI.getTaxonName(result.taxon);
        const obs = new INatObservation(result);
        let taxonSummary = summaries.get(name);
        if (!taxonSummary) {
            taxonSummary = createTaxonSummary(result.taxon, api);
            summaries.set(name, taxonSummary);
        }
        taxonSummary.count++;
        if (result.quality_grade === "research") {
            taxonSummary.countResearchGrade++;
        }
        if (obs.isObscured()) {
            taxonSummary.countObscured++;
        }
        if (obs.coordsArePublic()) {
            taxonSummary.countPublic++;
        }
    }

    /** @type {Map<number,SummaryEntry[]>} */
    const childMap = new Map();
    /** @type {Map<number,SummaryEntry>} */
    const idMap = new Map();

    // Check the summaries to see if there are any with multiple children that should have the option to view them together.
    for (const entry of summaries.values()) {
        const parentId = entry.parent_id;
        idMap.set(entry.taxon_id, entry);
        let children = childMap.get(parentId);
        if (!children) {
            children = [];
            childMap.set(parentId, children);
        }
        children.push(entry);
    }

    // Convert to array.
    /** @type {SummaryEntry[]} */
    const summaryArray = [...summaries.values()];

    // For any parent with at least 2 children, add an option to view all descendants.
    for (const [parentId, childSummaries] of childMap) {
        const parentSummary = idMap.get(parentId);
        if (childSummaries.length + (parentSummary ? 1 : 0) < 2) {
            continue;
        }

        /** @type {SummaryEntry} */
        let summary;
        if (!parentSummary) {
            const taxon = await api.getTaxonData(parentId.toString());
            summary = createTaxonSummary(taxon, api, true);
        } else {
            summary = { ...parentSummary };
            summary.is_branch = true;
        }
        summary.displayName += " branch";
        summaryArray.push(
            generateBranchSummary(summary, childSummaries, childMap)
        );
    }

    return summaryArray.sort((a, b) => {
        // If they have the same id, one is the branch summary; sort this first
        if (a.taxon_id === b.taxon_id) {
            return a.is_branch ? -1 : 1;
        }
        // If they have the same parent, sort alphabetically.
        if (a.parent_id === b.parent_id) {
            return a.name.localeCompare(b.name);
        }
        // If one is the parent of the other, sort the parent first.
        if (b.ancestor_ids.includes(a.taxon_id)) {
            return -1;
        }
        if (a.ancestor_ids.includes(b.taxon_id)) {
            return 1;
        }

        // Otherwise find their common ancestor, and sort by the child of the common ancestor so it is deterministic.
        const ancestor = findCommonAncestor(a, b);
        const aIndex = a.ancestor_ids.findIndex((v) => v === ancestor);
        const bIndex = b.ancestor_ids.findIndex((v) => v === ancestor);
        return a.ancestor_ids[aIndex + 1] - b.ancestor_ids[bIndex + 1];
    });
}

/**
 * @param {SummaryEntry} summary
 * @param {SummaryEntry[]} children
 * @param {Map<number,SummaryEntry[]>} childMap
 * @returns {SummaryEntry}
 */
function generateBranchSummary(summary, children, childMap) {
    for (const child of children) {
        summary.count += child.count;
        summary.countObscured += child.countObscured;
        summary.countResearchGrade += child.countResearchGrade;
        summary.countPublic += child.countPublic;
        const newChildren = childMap.get(child.taxon_id);
        if (newChildren) {
            summary = generateBranchSummary(summary, newChildren, childMap);
        }
    }
    return summary;
}

/**
 * @param {INatData.TaxonData} taxon
 * @param {INatAPI} api
 * @param {boolean} [is_branch=false]
 * @returns {SummaryEntry}
 */
function createTaxonSummary(taxon, api, is_branch = false) {
    return {
        name: INatAPI.getTaxonName(taxon),
        is_branch: is_branch,
        taxon_id: taxon.id,
        parent_id: taxon.parent_id,
        ancestor_ids: taxon.ancestor_ids,
        displayName: api.getTaxonFormName(taxon, false),
        rank: taxon.rank,
        count: 0,
        countObscured: 0,
        countPublic: 0,
        countResearchGrade: 0,
    };
}

/**
 * @param {SummaryEntry} a
 * @param {SummaryEntry} b
 * @returns {number}
 */
function findCommonAncestor(a, b) {
    for (let index = a.ancestor_ids.length - 1; index >= 0; index--) {
        const id = a.ancestor_ids[index];
        if (b.ancestor_ids.includes(id)) {
            return id;
        }
    }
    throw new Error();
}
