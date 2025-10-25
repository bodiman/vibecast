# Major Refactor

LLM Agents have baseline knowledge. As we interact with them in a particular task, they aggregate important domain knowledge that allows them to solve problems. As they operate and experiment, Agents build true domain expertise, separate from training data and documentation. We believe this domain expertise can be saved, shared, and monetized.

We would like to develop "Context Marketplace", the github for mathematical modeling. It is two things

1. A protocol that allows LLMs to develop, maintain, and interact with model graphs, whose nodes contain time dependent arrays. The edges between the nodes captures mathematical relationships. This is a similar concept to the current implementation.

2. A marketplace where users can post their model grraphs and load other people's graphs for use in their own models.