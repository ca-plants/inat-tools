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

it("test no results", () => {
    const summary = summarizeObservations([], API);
    expect(summary.length).toBe(0);
});

it("test 1 obs", () => {
    const summary = summarizeObservations([OBS_CUSCUTA], API);
    expect(summary.length).toBe(1);
});

it("test obs with genus and obs with child species", () => {
    const summary = summarizeObservations(
        [OBS_CUSCUTA, OBS_CUSCUTA_PACIFICA],
        API
    );
    expect(summary.length).toBe(3);
});
