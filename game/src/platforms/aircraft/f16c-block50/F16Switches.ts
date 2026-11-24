/** Switch ids owned by the F-16 package (simulation test switches; not real F-16 controls). */
export const F16_SWITCHES = Object.freeze({ flcsMode: "f16.flcs.mode", testCg: "f16.test.cg" });

/** CG test positions (fraction of MAC). 0.35 is the dataset's nominal; aft positions are within the
 * range NASA TP-1538 investigated for relaxed static stability and use the same unmodified tables. */
export const F16_TEST_CG = Object.freeze({ NOMINAL: 0.35, AFT: 0.40, "FULL AFT": 0.45 } as const);
