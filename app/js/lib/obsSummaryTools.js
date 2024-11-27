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
 * @returns {SummaryEntry[]}
 */
export function summarizeObservations(rawResults, api) {
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
            taxonSummary = {
                name: name,
                taxon_id: result.taxon.id,
                parent_id: result.taxon.parent_id,
                displayName: api.getTaxonFormName(result.taxon, false),
                rank: result.taxon.rank,
                count: 0,
                countObscured: 0,
                countPublic: 0,
                countResearchGrade: 0,
            };
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
        if (!parentSummary) {
            // TODO - HANDLE THIS CASE.
            throw new Error();
        }
        const summary = { ...parentSummary };
        summary.displayName += " branch";
        summary.parent_id = undefined;
        summaryArray.push(generateBranchSummary(summary, childSummaries));
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
 * @returns {SummaryEntry}
 */
function generateBranchSummary(summary, children) {
    for (const child of children) {
        summary.count += child.count;
        summary.countObscured += child.countObscured;
        summary.countResearchGrade += child.countResearchGrade;
        summary.countPublic += child.countPublic;
    }
    return summary;
}
