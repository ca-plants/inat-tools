import { summarizeObservations } from "../../app/js/lib/obsSummaryTools.js";
import { MockAPI, MockTaxa } from "../js/mockapi.js";
import { makeObservationData } from "../js/mockdata.js";

const API = new MockAPI();

const OBS_CUSCUTA = makeObservationData(
    await API.getTaxonData(MockTaxa.Cuscuta.toString())
);
const OBS_CUSCUTA_PACIFICA = makeObservationData(
    await API.getTaxonData(MockTaxa.Cuscuta_pacifica.toString())
);
const OBS_CUSCUTA_PACIFICA_PACIFICA = makeObservationData(
    await API.getTaxonData(MockTaxa.Cuscuta_pacifica_pacifica.toString())
);
const OBS_CUSCUTA_CALIFORNICA = makeObservationData(
    await API.getTaxonData(MockTaxa.Cuscuta_californica.toString())
);

it("test no results", async () => {
    const summary = await summarizeObservations([], API);
    expect(summary.length).toBe(0);
});

it("test 1 obs", async () => {
    const summary = await summarizeObservations([OBS_CUSCUTA], API);
    expect(summary.length).toBe(1);
});

it("test obs with genus and obs with child species", async () => {
    const summary = await summarizeObservations(
        [OBS_CUSCUTA, OBS_CUSCUTA_PACIFICA],
        API
    );
    expect(summary.length).toBe(3);
});

it("test with no genus and 2 obs with species of same genus", async () => {
    const summary = await summarizeObservations(
        [OBS_CUSCUTA_CALIFORNICA, OBS_CUSCUTA_PACIFICA],
        API
    );
    expect(summary.length).toBe(3);
});

it("test with taxa nested 3 levels", async () => {
    const summary = await summarizeObservations(
        [
            OBS_CUSCUTA_CALIFORNICA,
            OBS_CUSCUTA_PACIFICA,
            OBS_CUSCUTA_PACIFICA_PACIFICA,
        ],
        API
    );

    // There should be 2 levels of summary.
    expect(summary.length).toBe(5);
    // Top level should show 3 observations.
    const top = summary.filter(
        (s) => s.taxon_id === MockTaxa.Cuscuta && s.is_branch
    );
    expect(top.length).toBe(1);
    expect(top[0].count).toBe(3);
});
