import { expect, it } from "@jest/globals";
import { makeObservationData } from "../js/mockdata.js";
import { MockAPI, MockTaxa } from "../js/mockapi.js";
import { INatObservation } from "../../app/js/lib/inatobservation.js";

const API = new MockAPI();

/**
 * @param {import("../js/mockdata.js").MockDataOptions} options
 * @returns {Promise<INatObservation>}
 */
async function getObs(options) {
    const obs = new INatObservation(
        makeObservationData(
            await API.getTaxonData(MockTaxa.Cuscuta_californica.toString()),
            options,
        ),
    );
    return obs;
}

/**
 * @param {string|null} body
 * @param {string} date
 * @param {string} login
 * @returns {import("../../app/js/types.js").InatCommentData}
 */
function makeComment(body, date, login) {
    return {
        body: body,
        created_at: `${date}T16:35:48-07:00`,
        user: { login: login },
    };
}

it("no comments", async () => {
    const obs = await getObs({});
    expect(obs.hasComments()).toBe(false);
});

it("comment only", async () => {
    const obs = await getObs({
        comments: [makeComment("A", "2026-01-02", "u1")],
    });

    expect(obs.hasComments()).toBe(true);
    const comments = obs.getComments();
    expect(comments.length).toBe(1);
    expect(comments[0].body).toBe("A");
});

it("identification only", async () => {
    const obs = await getObs({
        identifications: [makeComment("A", "2026-01-02", "u1")],
    });

    expect(obs.hasComments()).toBe(true);
    const comments = obs.getComments();
    expect(comments.length).toBe(1);
    expect(comments[0].body).toBe("A");
});

it("identification with null comment", async () => {
    const obs = await getObs({
        identifications: [makeComment(null, "2026-01-02", "u1")],
    });

    expect(obs.hasComments()).toBe(false);
    const comments = obs.getComments();
    expect(comments.length).toBe(0);
});

it("identification with blank comment", async () => {
    const obs = await getObs({
        identifications: [makeComment("", "2026-01-02", "u1")],
    });

    expect(obs.hasComments()).toBe(false);
    const comments = obs.getComments();
    expect(comments.length).toBe(0);
});

it("comment then identification", async () => {
    const obs = await getObs({
        comments: [makeComment("A", "2026-01-02", "u1")],
        identifications: [makeComment("B", "2026-01-03", "u1")],
    });

    expect(obs.hasComments()).toBe(true);
    const comments = obs.getComments();
    expect(comments.length).toBe(2);
    expect(comments[0].body).toBe("A");
    expect(comments[1].body).toBe("B");
});

it("identification then comment", async () => {
    const obs = await getObs({
        comments: [makeComment("A", "2026-01-04", "u1")],
        identifications: [makeComment("B", "2026-01-03", "u1")],
    });

    expect(obs.hasComments()).toBe(true);
    const comments = obs.getComments();
    expect(comments.length).toBe(2);
    expect(comments[0].body).toBe("B");
    expect(comments[1].body).toBe("A");
});
