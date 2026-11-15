---
name: brunson-pass
description: Run the Brunson pass on a funnel before anyone reviews or launches it. Write hook, story and offer for every step from the ad to the result, test curiosity headlines, name the belief that stops the buyer and where the page answers it, build the offer stack, list questions for the client, and answer every designer check in writing. Required on every funnel built in the conversion system (brand.pass); also use it to audit a live funnel that is not converting. Based on Russell Brunson's seven steps.
---

# Brunson pass

A passing build proves the funnel is legal: contrast, form length, honest proof. It does not prove the funnel will convert. The Brunson pass is the judgement work the build cannot do, written down so a designer can review it and a client can answer it.

In the conversion system the pass lives in the brand file as `pass`. A real client funnel (`"fictional": false`) does not build without it. The system sheet (`/<client>/system`) shows it.

Run it after the strategy and the first draft, before review. Run it again whenever the copy or the funnel type changes.

## 1. Hook, story and offer on every step

List every step a visitor goes through, from the ad to the result. For each, write one line for each of the three parts.

| Part | Job | Question to ask |
|---|---|---|
| Hook | Stop them. | Why would someone stop scrolling, or keep tapping, here? |
| Story | Raise the value of the offer. | What makes the next yes feel worth it? It can be one sentence. |
| Offer | The trade. | What exactly do they give, and what do they get? A tap, an email, money. |

Cover at least the ad, the first screen and the contact step. Add every question screen that does different work, the result or thank-you screen, and the second yes.

When a live step underperforms, find which of the three is weak. Fix that one, not the whole page.

## 2. Curiosity headline

If visitors think they already know what they will get, ad costs rise and opt-ins fall. Write at least two headlines to test.

- Lead with the result they want, or the question they are asking themselves.
- The subhead promises the result. It does not list what is inside.
- A question headline suits a quiz. A named doubt ("even without a big following") suits a webinar or VSL.

## 3. The doubt

Name the one belief that stops this customer buying. Write how the page answers it and which section does the answering. The section must be in the recipe; the build checks it.

Answer the doubt with the client's own words, facts and proof. If there is no proof yet, the answer goes to the client as a question rather than onto the page as a claim.

## 4. The offer stack (the first yes)

Raise the value instead of cutting the price. List everything the visitor gets for the first yes. Each item should solve the problem the last one creates.

Mark each item `confirmed` (the client offers it, or the funnel itself delivers it) or `ask-client`. Draft ideas as `ask-client`. Never present an unconfirmed bonus, discount or price as real. A stack with nothing confirmed is not launch-ready.

## 5. Questions for the client

Everything the pass needs and cannot verify: offer terms, proof with permission, story details, the second yes. Short and answerable.

## 6. Answer the designer checks

Write a direct answer to each check, by id. Say where the page does it, or say plainly that it does not yet.

| Id | Check |
|---|---|
| `hook-story-offer` | Can you name the hook, the story and the offer on every step? |
| `curiosity` | Does the headline make the visitor curious, or do they already know what they will get? |
| `doubt` | Does the page name the belief that stops this customer, and answer it? |
| `not-for` | Does the page say who it is not for? |
| `proof-near-ask` | Is proof next to every ask? |
| `smallest-yes` | Is the first ask the smallest possible yes? |
| `second-yes` | Is there a second yes after this one? |

## Shape in the brand file

```json
"pass": {
  "steps": [{ "step": "Ad", "hook": "…", "story": "…", "offer": "…" }],
  "headline_options": ["…", "…"],
  "doubt": { "belief": "…", "answer": "…", "where": "benefits" },
  "offer_stack": [{ "item": "…", "status": "confirmed" }, { "item": "…", "status": "ask-client" }],
  "client_questions": ["…"],
  "checks": { "hook-story-offer": "…", "curiosity": "…", "doubt": "…", "not-for": "…", "proof-near-ask": "…", "smallest-yes": "…", "second-yes": "…" }
}
```

Then change the page copy to match the pass: the chosen headline, the doubt answered in its section, the offer stack reflected in the contact step. Run `validate_brand`, build, and put the pass on the board beside the funnel for Keep, Change or Drop.

## Auditing a live funnel

The same six steps work on a funnel you did not build. Scan it (`npm run scan`), walk it on a phone, and write the pass as findings: for each step, which of hook, story or offer is weakest and why. Label what you observed and what you infer.

## Rules

- Copy and facts come from the client. A pass may propose headlines and offer ideas; it never states an unconfirmed fact as true.
- Keep FACT, OBSERVATION, INFERENCE, HYPOTHESIS and UNKNOWN apart.
- The pass is not approval. The designer decides on the board.
