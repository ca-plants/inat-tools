import { INatAPI } from "./inatapi.js";
import { INatObservation } from "./inatobservation.js";
/**
 * @typedef {{
 * name:string,
 * taxon_id:number,
 * parent_id:number|undefined,
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
        if (parentId === undefined) {
            throw new Error();
        }
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
            summary = createTaxonSummary(taxon, api);
        } else {
            summary = { ...parentSummary };
        }
        summary.parent_id = undefined;
        summary.displayName += " branch";
        summaryArray.push(
            generateBranchSummary(summary, childSummaries, childMap)
        );
    }

    return summaryArray.sort((a, b) => {
        const n = a.name.localeCompare(b.name);
        if (n !== 0) {
            return n;
        }
        return a.parent_id === undefined ? -1 : 1;
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
 */
function createTaxonSummary(taxon, api) {
    return {
        name: INatAPI.getTaxonName(taxon),
        taxon_id: taxon.id,
        parent_id: taxon.parent_id,
        displayName: api.getTaxonFormName(taxon, false),
        rank: taxon.rank,
        count: 0,
        countObscured: 0,
        countPublic: 0,
        countResearchGrade: 0,
    };
}
