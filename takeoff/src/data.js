/* Canonical historical teaching snapshot. Source conditions travel with each result. */
const DATA = {
  "INTRO": {
    "title": "How much has AI changed?",
    "body": [
      "A benchmark is a test with defined tasks and a scoring rule. It gives us something to measure, but it cannot stand for every kind of work.",
      "Estimate the missing part of five historical charts, then compare your line with published results. Look for gains, limits, and changes in how the tests were run."
    ],
    "note": "A teaching snapshot, not a live leaderboard. Published measurements, illustrative examples, and hypothetical forecasts are labeled separately.",
    "cta": "Estimate the first measurement"
  },
  "AXIS_END": "2026-09-09",
  "ROUNDS": [
    {
      "id": "swebench",
      "name": "Fixing real bugs",
      "metric": "SWE-bench Verified",
      "real": "Researchers call this test SWE-bench Verified.",
      "unit": "%",
      "scale": "linear",
      "yMin": 0,
      "yMax": 100,
      "xLabel": "When the model was released",
      "yLabel": "Bugs actually fixed",
      "yLabelShort": "Bugs fixed",
      "askDate": "2025-09-29",
      "plain": "An AI system receives a real GitHub issue and a repository, then attempts a code patch. Automated tests score whether the issue was resolved. A passing test is not a guarantee of a correct patch in every situation.",
      "human": "There is no directly comparable human percentage in this series. The tasks came from issues that people resolved, but elapsed time and working conditions differ.",
      "example": {
        "kind": "text",
        "label": "A task from this test looks like",
        "body": "“Calling .fit() twice on the same estimator gives a different result the second time. Expected: identical output. Actual: coefficients differ by ~1e-3.”\n\nThe model gets that report and 1.2 million lines of code. It has to find the cause and write the patch.",
        "note": "Illustrative bug-report format, not a reproduced benchmark item; repository size is also illustrative."
      },
      "question": "Starting with this February 2025 result, where do the selected reports end in September?",
      "shown": [
        {
          "date": "2025-02-24",
          "label": "Claude 3.7 Sonnet",
          "value": 63.7,
          "note": "489-task subset; standard agentic setup; 70.3% reported with parallel test-time compute.",
          "status": "primary",
          "src": "anthropic-37"
        }
      ],
      "hidden": [
        {
          "date": "2025-05-22",
          "label": "Claude Opus 4",
          "value": 72.5,
          "status": "primary",
          "src": "anthropic-4"
        },
        {
          "date": "2025-08-07",
          "label": "GPT-5",
          "value": 74.9,
          "status": "primary",
          "src": "openai-gpt5",
          "note": "Fixed 477-task subset; system and protocol differ from other reports."
        },
        {
          "date": "2025-09-29",
          "label": "Claude Sonnet 4.5",
          "value": 77.2,
          "note": "Full 500 tasks; mean of 10 trials; 200K thinking budget. 82.0% reported with parallel test-time compute.",
          "status": "primary",
          "src": "anthropic-45"
        }
      ],
      "endNote": "Selected reports through September 2025",
      "reveal": {
        "headline": "Better reported results, with different setups.",
        "body": "The selected reports rise from 63.7% to 77.2% during 2025. These are measurements of configured systems. Because subsets, tools, and budgets differ, the line does not isolate an improvement caused by the model alone.",
        "caveat": "The model, tools, prompts, and task subset can differ. GPT-5 used a fixed 477-task subset, while SWE-bench Verified contains 500 tasks. A single-attempt label does not make these evaluations equivalent. Inspect source conditions before comparing small differences."
      }
    },
    {
      "id": "gpqa",
      "name": "Answering science questions",
      "metric": "GPQA Diamond",
      "real": "Researchers call this test GPQA Diamond.",
      "unit": "%",
      "scale": "linear",
      "yMin": 0,
      "yMax": 100,
      "xLabel": "Model release / evaluation date",
      "yLabel": "Questions answered correctly",
      "yLabelShort": "Answered right",
      "askDate": "2026-02-19",
      "plain": "GPQA Diamond contains 198 multiple-choice questions in physics, chemistry, and biology. It tests difficult scientific question answering, rather than the whole process of doing scientific research.",
      "human": "Human comparisons depend on recruitment and question subset. OpenAI’s expert evaluation and the original GPQA paper’s non-expert result are not a matched pair of Diamond baselines. No human line is plotted here.",
      "example": {
        "kind": "text",
        "label": "A question from this test looks like",
        "body": "One question names three specific chemical reagents, asks which product forms and why the competing reaction is disfavoured, and offers four plausible answers — three of which are exactly what you would get by making one reasonable mistake.",
        "note": "Illustrative description of the format, not a reproduced GPQA item."
      },
      "question": "Starting with GPT-4o, where do the later reported results end?",
      "markers": [],
      "shown": [
        {
          "date": "2024-05-13",
          "label": "GPT-4o",
          "value": 50.6,
          "status": "primary",
          "src": "openai-o1",
          "note": "Model release date. Result reported September 12, 2024; GPQA Diamond pass@1."
        }
      ],
      "hidden": [
        {
          "date": "2024-09-12",
          "label": "o1 research evaluation",
          "value": 77.3,
          "status": "primary",
          "src": "openai-o1",
          "note": "Evaluation report date, not a product release; maximum test-time compute; pass@1."
        },
        {
          "date": "2025-11-18",
          "label": "Gemini 3 Pro",
          "value": 91.9,
          "status": "primary",
          "src": "gemini3",
          "note": "No tools; Thinking HIGH. Different vendor protocol."
        },
        {
          "date": "2026-02-19",
          "label": "Gemini 3.1 Pro",
          "value": 94.3,
          "status": "primary",
          "src": "gemini3",
          "note": "No tools; Thinking HIGH. Release date from Google announcement, score from model table.",
          "extraSrc": [
            "gemini31"
          ]
        }
      ],
      "reveal": {
        "headline": "Higher scores on a demanding, bounded question set.",
        "body": "The published results move from 50.6% for GPT-4o to 94.3% for Gemini 3.1 Pro. The OpenAI and Google reports use the same named question set, but they are not one independently controlled evaluation.",
        "caveat": "The o1 research result used high test-time compute and was not the o1-preview product released that day. Google reports Thinking HIGH without tools. A high score on 198 science questions does not establish that a model can independently choose research questions, run experiments, or work as a scientist."
      }
    },
    {
      "id": "metr",
      "name": "Completing longer tasks",
      "metric": "METR time horizon",
      "real": "This is METR’s “time horizon” measure.",
      "unit": "min",
      "scale": "log",
      "yMin": 1,
      "yMax": 1000,
      "xLabel": "When the model was released",
      "yLabel": "How long that job takes a person",
      "yLabelShort": "Job length, in human time",
      "askDate": "2025-11-24",
      "plain": "METR evaluates software and research-engineering tasks with measured human completion times. Its 50% time horizon estimates the human task duration at which an AI system succeeds half the time. This is a fitted threshold, not the time the AI runs.",
      "human": "A five-hour horizon means an estimated 50% success rate on this task distribution at a human-expert duration of five hours. It does not mean reliable five-hour work in every job. The shaded band shows uncertainty in the fitted horizon.",
      "example": {
        "kind": "ladder",
        "label": "Jobs of different sizes",
        "items": [
          {
            "t": "2 min",
            "s": "Rename a variable everywhere it appears"
          },
          {
            "t": "15 min",
            "s": "Write a small script to reformat a data file"
          },
          {
            "t": "1 hour",
            "s": "Track down why one test fails only on Tuesdays"
          },
          {
            "t": "4 hours",
            "s": "Add a feature across several files, with tests"
          },
          {
            "t": "1 day+",
            "s": "Port a component to a different framework"
          }
        ],
        "note": "Illustrative task sizes, not measured durations of these specific examples."
      },
      "question": "What human task duration corresponds to 50% success for the last selected model?",
      "scaleNote": "Logarithmic scale: equal vertical distances mean equal ratios. A straight line indicates proportional growth over that interval; it does not prove that growth continues.",
      "shown": [
        {
          "date": "2023-03-14",
          "label": "GPT-4",
          "value": 3.5,
          "lo": 1.6,
          "hi": 6.9,
          "status": "primary",
          "src": "metr-th11"
        },
        {
          "date": "2025-02-24",
          "label": "Claude 3.7 Sonnet",
          "value": 60,
          "lo": 32,
          "hi": 106,
          "status": "primary",
          "src": "metr-th11"
        }
      ],
      "hidden": [
        {
          "date": "2025-04-16",
          "label": "o3",
          "value": 121,
          "lo": 74,
          "hi": 201,
          "status": "primary",
          "src": "metr-th11"
        },
        {
          "date": "2025-05-22",
          "label": "Claude Opus 4",
          "value": 101,
          "lo": 58,
          "hi": 170,
          "status": "primary",
          "src": "metr-th11"
        },
        {
          "date": "2025-08-07",
          "label": "GPT-5",
          "value": 214,
          "lo": 117,
          "hi": 480,
          "status": "primary",
          "src": "metr-th11"
        },
        {
          "date": "2025-11-24",
          "label": "Claude Opus 4.5",
          "value": 320,
          "lo": 170,
          "hi": 729,
          "status": "primary",
          "src": "metr-th11"
        }
      ],
      "reveal": {
        "headline": "Longer measured horizons, with wide uncertainty.",
        "body": "The January 2026 Time Horizon 1.1 report estimates 3.5 minutes for GPT-4 and 320 minutes for Claude Opus 4.5. The series includes a dip between o3 and Opus 4, and uncertainty intervals overlap. These are estimates by model release date, not observations of a smooth curve.",
        "caveat": "Tasks concentrate on software and research engineering, with relatively clear success criteria. The horizon is at 50% success, not reliable completion. Selecting a later start date changes a fitted doubling time; that sensitivity does not prove acceleration. METR’s June 2026 Sol estimate was explicitly non-robust and is discussed separately in Details."
      },
      "limitations": {
        "title": "A later estimate excluded from the trend",
        "body": "METR reported a GPT-5.6 Sol 50% horizon of 11.3 hours, with a 95% interval of 5–40 hours, on June 26, 2026. The report says none of its estimates should be considered robust and describes a high detected cheating rate. This is excluded from the trend rather than shown as a settled advance.",
        "src": "metr-sol"
      }
    },
    {
      "id": "price",
      "name": "What it costs",
      "metric": "Price at an MMLU performance threshold",
      "real": "Epoch AI: price at or above 86% on MMLU.",
      "unit": "$",
      "scale": "log",
      "yMin": 0.05,
      "yMax": 60,
      "xLabel": "Date",
      "yLabel": "USD per million tokens (blended)",
      "yLabelShort": "USD / million tokens",
      "askDate": "2025-02-05",
      "plain": "Hold one benchmark threshold fixed: at least 86% on MMLU, matching the GPT-4 reference used by Epoch. Then track the cheapest qualifying API price in its published snapshot. This isolates a cost trend for that threshold, not a universal level of ability.",
      "human": "The unit is US dollars per million tokens, with input and output prices blended in a 3:1 ratio. Tokens are text chunks; this is not a price per million words, an input-only price, or the full cost of a workflow.",
      "example": {
        "kind": "text",
        "label": "Why hold the ability fixed",
        "body": "Two models can exceed the same test threshold at different listed prices. That answers a cost question at that threshold. Comparing the newest flagship products may change both price and capability at once.",
        "note": "Illustration of Epoch’s threshold-based method."
      },
      "question": "The first three prices are shown. What is the final price in this February 2025 snapshot?",
      "scaleNote": "Logarithmic scale: equal vertical distances mean equal price ratios. A line can describe past cost decline without predicting future prices.",
      "shown": [
        {
          "date": "2023-03-14",
          "label": "GPT-4",
          "value": 37.5,
          "status": "primary",
          "src": "epoch-price"
        },
        {
          "date": "2023-11-06",
          "label": "GPT-4 Turbo",
          "value": 15,
          "status": "primary",
          "src": "epoch-price"
        },
        {
          "date": "2024-05-13",
          "label": "GPT-4o",
          "value": 7.5,
          "status": "primary",
          "src": "epoch-price"
        }
      ],
      "hidden": [
        {
          "date": "2024-05-23",
          "label": "Gemini 1.5 Pro",
          "value": 2.19,
          "status": "primary",
          "src": "epoch-price"
        },
        {
          "date": "2025-02-05",
          "label": "Gemini 2.0 Flash",
          "value": 0.18,
          "status": "primary",
          "src": "epoch-price"
        }
      ],
      "endNote": "Published snapshot ends February 2025",
      "reveal": {
        "headline": "About 200 times cheaper in this snapshot.",
        "body": "The selected price falls from $37.50 to $0.18 per million tokens, using rounded reported values. The criterion is at least 86% on MMLU. Lower price at this threshold is a practical change, even though it is not a measurement of every capability.",
        "caveat": "These are listed API prices, blended 3:1 input to output, through February 2025. Other thresholds produce different trends. Prices exclude integration, human review, and differences in the number of tokens a workflow needs. No line is projected beyond the snapshot."
      }
    },
    {
      "id": "arc",
      "turn": true,
      "name": "Adapting to unfamiliar puzzles",
      "metric": "ARC-AGI-1",
      "real": "This is the ARC-AGI benchmark, created by François Chollet.",
      "unit": "%",
      "scale": "linear",
      "yMin": 0,
      "yMax": 100,
      "xLabel": "Date",
      "yLabel": "Puzzles solved",
      "yLabelShort": "Puzzles solved",
      "askDate": "2024-12-20",
      "plain": "This test is made of small coloured grids. You are shown two or three examples of some rule being applied, and then a fresh grid to apply the same rule to. Nobody tells you what the rule is — working it out from those few examples is the whole test.",
      "human": "The small example in Details illustrates the puzzle format. It is not a representative difficulty sample or a measured human baseline.",
      "example": {
        "kind": "arc",
        "label": "Try an illustrative ARC-style puzzle",
        "pairs": [
          {
            "in": [
              [
                0,
                2,
                0,
                0
              ],
              [
                0,
                0,
                0,
                3
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ]
            ],
            "out": [
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                2,
                0,
                3
              ]
            ]
          },
          {
            "in": [
              [
                1,
                0,
                4,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ]
            ],
            "out": [
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                0,
                0,
                0,
                0
              ],
              [
                1,
                0,
                4,
                0
              ]
            ]
          }
        ],
        "test": [
          [
            0,
            0,
            0,
            5
          ],
          [
            6,
            0,
            0,
            0
          ],
          [
            0,
            0,
            7,
            0
          ],
          [
            0,
            0,
            0,
            0
          ]
        ],
        "answer": [
          [
            0,
            0,
            0,
            0
          ],
          [
            0,
            0,
            0,
            0
          ],
          [
            0,
            0,
            0,
            0
          ],
          [
            6,
            0,
            7,
            5
          ]
        ],
        "note": "An ARC-style task in the real format. The actual test set is hundreds of these, and they get much harder."
      },
      "question": "What did the December 2024 o3 evaluation report on ARC-AGI-1?",
      "shown": [
        {
          "date": "2020-06-11",
          "label": "GPT-3",
          "value": 0,
          "status": "primary",
          "src": "arc-o3"
        },
        {
          "date": "2024-05-13",
          "label": "GPT-4o",
          "value": 5,
          "status": "primary",
          "src": "arc-o3"
        }
      ],
      "hidden": [
        {
          "date": "2024-12-20",
          "label": "o3 preview, lower compute",
          "value": 75.7,
          "note": "6 samples; about $26/task at retrospective prices.",
          "status": "primary",
          "src": "arc-o3"
        },
        {
          "date": "2024-12-20",
          "label": "o3 preview, higher compute",
          "value": 87.5,
          "note": "1,024 samples; about $4,560/task at retrospective prices; 172 times the compute.",
          "status": "primary",
          "src": "arc-o3"
        }
      ],
      "reveal": {
        "headline": "A large result, with a substantial compute budget.",
        "body": "ARC Prize reported 75.7% for a lower-compute o3 preview configuration and 87.5% at higher compute in December 2024. The tuned preview was distinct from the later released o3. These points share a date because they are configurations, not improvement over elapsed time.",
        "caveat": "ARC-AGI-1 is a specific puzzle benchmark. The evaluation involved training on public practice examples, and the high-compute configuration was much more expensive. It did not establish artificial general intelligence. Changing benchmark version changes the measurement; the comparison below is separate from this curve."
      },
      "twist": {
        "metric": "ARC-AGI-2, then ARC-AGI-3",
        "question": "A newer test changes the task. A different harness can change the result too. What can we compare fairly?",
        "series": [],
        "finale": {
          "headline": "Hold the test and effort fixed; inspect the system.",
          "what": "ARC-AGI-3 uses interactive games and reports Relative Human Action Efficiency (RHAE). These percentages are not the share of ARC-AGI-1 puzzles solved, so the bars do not continue the earlier curve.",
          "body": "ARC Prize’s September 3, 2026 evaluation reported these GPT-6 Astra results on the same semi-private game set, with reasoning effort held at high.",
          "bars": [
            {
              "label": "Astra · standard harness",
              "value": 54.8,
              "kind": "mid",
              "note": "High effort · $40,705 total reported cost"
            },
            {
              "label": "Astra · provider harness",
              "value": 99.9,
              "kind": "gold",
              "note": "High effort · $18,817 total reported cost"
            }
          ],
          "punch": "The reported RHAE differs by 45.1 percentage points. The model label and effort are held fixed; the harness changes. A score describes a configured system, not just the model name.",
          "caveat": "These are aggregate results under the reported setup, not a randomized causal estimate and not a measure of success on all work. Other effort settings give other numbers. Sol’s separate 13.3% and 38.3% results used a public game set and should not be compared directly with these bars.",
          "close": "Before repeating a headline, name the test version, metric, model, effort, harness, and task set.",
          "status": "primary",
          "src": "arc-astra",
          "extraSrc": [
            "arc-3-openai"
          ]
        }
      }
    }
  ],
  "LABS": {
    "openai": {
      "name": "OpenAI",
      "region": "US",
      "hue": 174
    },
    "anthropic": {
      "name": "Anthropic",
      "region": "US",
      "hue": 22
    },
    "google": {
      "name": "Google DeepMind",
      "region": "US",
      "hue": 210
    },
    "ai2": {
      "name": "Allen Institute",
      "region": "US",
      "hue": 45
    }
  },
  "MODELS": [
    {
      "d": "2022-11-30",
      "name": "ChatGPT",
      "lab": "openai",
      "open": false,
      "src": "chatgpt",
      "lic": "Provider terms"
    },
    {
      "d": "2024-09-12",
      "name": "o1-preview",
      "lab": "openai",
      "open": false,
      "src": "openai-o1",
      "lic": "Provider terms"
    },
    {
      "d": "2025-02-24",
      "name": "Claude 3.7 Sonnet",
      "lab": "anthropic",
      "open": false,
      "src": "anthropic-37",
      "lic": "Provider terms"
    },
    {
      "d": "2025-05-22",
      "name": "Claude 4 family",
      "lab": "anthropic",
      "open": false,
      "src": "anthropic-4",
      "lic": "Provider terms"
    },
    {
      "d": "2025-08-05",
      "name": "gpt-oss",
      "lab": "openai",
      "open": true,
      "src": "gpt-oss",
      "lic": "Apache 2.0"
    },
    {
      "d": "2025-08-07",
      "name": "GPT-5",
      "lab": "openai",
      "open": false,
      "src": "openai-gpt5",
      "lic": "Provider terms"
    },
    {
      "d": "2025-09-29",
      "name": "Claude Sonnet 4.5",
      "lab": "anthropic",
      "open": false,
      "src": "anthropic-45",
      "lic": "Provider terms"
    },
    {
      "d": "2025-11-18",
      "name": "Gemini 3 Pro",
      "lab": "google",
      "open": false,
      "src": "gemini3-release",
      "lic": "Provider terms"
    },
    {
      "d": "2025-11-20",
      "name": "Olmo 3",
      "lab": "ai2",
      "open": true,
      "src": "olmo",
      "lic": "Open release; check the license for each asset"
    },
    {
      "d": "2025-11-24",
      "name": "Claude Opus 4.5",
      "lab": "anthropic",
      "open": false,
      "src": "anthropic-opus45",
      "lic": "Provider terms"
    },
    {
      "d": "2026-02-19",
      "name": "Gemini 3.1 Pro",
      "lab": "google",
      "open": false,
      "src": "gemini31",
      "lic": "Provider terms"
    }
  ],
  "UNLOCKS": [],
  "DOMAINS": [
    {
      "id": "work",
      "name": "Work and productivity",
      "lede": "Different people and workflows can produce different results.",
      "items": [
        {
          "title": "Customer-support agents resolved more issues per hour",
          "date": "2023-04-15",
          "what": "A study of 5,172 customer-support agents found an average 15% increase in issues resolved per hour after access to a generative AI assistant.",
          "machine": "Suggested responses and relevant information during live support conversations.",
          "human": "Agents remained responsible for the conversation and deciding which suggestions to use.",
          "caveat": "This was a staggered-deployment study in one work setting, not a randomized trial of every AI tool. Benefits varied across workers. The result is not a prediction for all occupations.",
          "src": "support-study",
          "status": "primary",
          "verdict": "verified",
          "dateLabel": "2023 study · revised published results"
        },
        {
          "title": "Experienced developers took longer with early-2025 tools",
          "date": "2025-07-10",
          "what": "METR randomized AI access across 246 real tasks completed by 16 experienced open-source developers. AI-allowed tasks took 19% longer, with a 95% confidence interval of 2% to 39% longer.",
          "machine": "Provided coding assistance with the tools available in the February–June 2025 study period.",
          "human": "Developers worked on repositories they knew well and decided how to use the available assistance.",
          "caveat": "This is a bounded early-2025 result, not a claim about today’s tools or all programmers. A February 2026 update suggests improvement in later data but says selection effects and concurrent-work timing prevent a reliable estimate of the magnitude.",
          "src": "metr-rct",
          "extraSrc": [
            "metr-rct-update"
          ],
          "status": "primary",
          "verdict": "verified"
        }
      ]
    },
    {
      "id": "science",
      "name": "Scientific systems",
      "lede": "Specialized systems answer different questions from general chat models.",
      "items": [
        {
          "title": "GenCast improved a probabilistic weather comparison",
          "date": "2024-12-04",
          "what": "In a 2019 evaluation, GenCast beat the ENS baseline on CRPS in 97.2% of 1,320 variable, lead-time, and level comparisons.",
          "machine": "Produced probabilistic forecast ensembles from historical weather data.",
          "human": "Built the system, selected evaluation variables and baselines, and interpreted the forecasts.",
          "caveat": "97.2% is the share of comparisons with a better probabilistic score, not forecast accuracy. Precipitation was excluded from the main results. A retrospective evaluation does not establish every operational outcome.",
          "src": "gencast",
          "status": "primary",
          "verdict": "verified"
        },
        {
          "title": "AlphaFold 3 predicted biomolecular structures",
          "date": "2024-05-08",
          "what": "AlphaFold 3 reports strong results for predicting structures of biomolecular complexes, including interactions involving proteins, DNA, RNA, and ligands.",
          "machine": "Predicted static three-dimensional structures from molecular inputs.",
          "human": "Provided experimental data, designed evaluations, and must still test biological function and practical hypotheses.",
          "caveat": "There is no single universal accuracy percentage. Static structure prediction is not simulation of molecular dynamics. The paper describes limits including stereochemistry and hallucinated structures.",
          "src": "alphafold3",
          "status": "primary",
          "verdict": "verified"
        }
      ]
    }
  ],
  "CUT": [
    {
      "claim": "One curve for “AI intelligence”",
      "why": "Benchmarks have different tasks, units, budgets, and versions. Combining their percentages into one rising line would invent a common scale."
    },
    {
      "claim": "A non-robust estimate as a settled advance",
      "why": "METR’s June 2026 Sol estimate is excluded from the historical curve and discussed in measurement Details with its warning."
    },
    {
      "claim": "A release count as a rate of capability progress",
      "why": "The timeline is a selected source-backed catalog. Its selection and publication practices do not make it a census or a capability measure."
    }
  ],
  "SOURCES": {
    "anthropic-37": {
      "t": "Anthropic — Claude 3.7 Sonnet",
      "u": "https://www.anthropic.com/news/claude-3-7-sonnet",
      "checked": "2026-09-09"
    },
    "anthropic-4": {
      "t": "Anthropic — Claude 4",
      "u": "https://www.anthropic.com/news/claude-4",
      "checked": "2026-09-09"
    },
    "anthropic-45": {
      "t": "Anthropic — Claude Sonnet 4.5",
      "u": "https://www.anthropic.com/news/claude-sonnet-4-5",
      "checked": "2026-09-09"
    },
    "anthropic-opus45": {
      "t": "Anthropic — Claude Opus 4.5",
      "u": "https://www.anthropic.com/news/claude-opus-4-5",
      "checked": "2026-09-09"
    },
    "openai-gpt5": {
      "t": "OpenAI — Introducing GPT-5",
      "u": "https://openai.com/index/introducing-gpt-5/",
      "checked": "2026-09-09"
    },
    "openai-o1": {
      "t": "OpenAI — Learning to reason with LLMs",
      "u": "https://openai.com/index/learning-to-reason-with-llms/",
      "checked": "2026-09-09"
    },
    "gemini3": {
      "t": "Google DeepMind — Gemini 3.1 Pro / 3 Pro comparison table",
      "u": "https://deepmind.google/models/gemini/pro/",
      "checked": "2026-09-09"
    },
    "metr-th11": {
      "t": "METR — Time Horizon 1.1",
      "u": "https://metr.org/blog/2026-1-29-time-horizon-1-1/",
      "checked": "2026-09-09"
    },
    "metr-sol": {
      "t": "METR — GPT-5.6 Sol evaluation",
      "u": "https://metr.org/blog/2026-06-26-gpt-5-6-sol/",
      "checked": "2026-09-09"
    },
    "metr-rct": {
      "t": "METR — Measuring the impact of early-2025 AI on experienced developer productivity",
      "u": "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
      "checked": "2026-09-09"
    },
    "epoch-price": {
      "t": "Epoch AI — LLM inference price trends",
      "u": "https://epoch.ai/data-insights/llm-inference-price-trends",
      "checked": "2026-09-09"
    },
    "arc-o3": {
      "t": "ARC Prize — OpenAI o3 breakthrough",
      "u": "https://arcprize.org/blog/oai-o3-pub-breakthrough",
      "checked": "2026-09-09"
    },
    "arc-astra": {
      "t": "ARC Prize — GPT-6 Astra on ARC-AGI-3 (Sept 2026)",
      "u": "https://arcprize.org/blog/astra",
      "checked": "2026-09-09"
    },
    "arc-3-openai": {
      "t": "OpenAI — How two settings tripled our ARC-AGI-3 scores",
      "u": "https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/",
      "checked": "2026-09-09"
    },
    "chatgpt": {
      "t": "OpenAI — Introducing ChatGPT",
      "u": "https://openai.com/index/chatgpt/",
      "checked": "2026-09-09"
    },
    "alphafold3": {
      "t": "AlphaFold 3 — Nature 630:493",
      "u": "https://www.nature.com/articles/s41586-024-07487-w",
      "checked": "2026-09-09",
      "verification": "Qualitative result and limitations corroborated from publisher-indexed text; no new numerical claim."
    },
    "gencast": {
      "t": "GenCast — Nature, December 2024",
      "u": "https://www.nature.com/articles/s41586-024-08252-9",
      "checked": "2026-09-09"
    },
    "olmo": {
      "t": "Allen Institute for AI — OLMo 3",
      "u": "https://allenai.org/blog/olmo3",
      "checked": "2026-09-09"
    },
    "gpt-oss": {
      "t": "OpenAI — Introducing gpt-oss",
      "u": "https://openai.com/index/introducing-gpt-oss/",
      "checked": "2026-09-09"
    },
    "gemini31": {
      "t": "Google — Gemini 3.1 Pro release",
      "u": "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/",
      "checked": "2026-09-09"
    },
    "gemini3-release": {
      "t": "Google Workspace — Gemini 3 Pro release",
      "u": "https://workspaceupdates.googleblog.com/2025/11/introducing-gemini-3-pro-for-gemini-app.html",
      "checked": "2026-09-09"
    },
    "metr-rct-update": {
      "t": "METR — Developer productivity study update, February 2026",
      "u": "https://metr.org/blog/2026-02-24-uplift-update/",
      "checked": "2026-09-09"
    },
    "support-study": {
      "t": "Stanford Digital Economy Lab — Generative AI at Work",
      "u": "https://digitaleconomy.stanford.edu/publication/generative-ai-at-work/",
      "checked": "2026-09-09"
    }
  },
  "SNAPSHOT": "2026-09-09"
};
if (typeof module !== "undefined" && module.exports) module.exports = DATA;
