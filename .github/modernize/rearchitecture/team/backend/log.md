## refactor-controllers — Route boundary and document layering
- Codebase/domain discoveries: document endpoints were the only assigned slice that could be fully moved without changing payloads; existing class/quiz/study/assignment controllers still contain SQL and use-case helpers.
- Wrong assumptions and corrections: the first syntax command ran from the workspace root instead of `server`; the first document patch also left the legacy factory below the new controller and was corrected.
- Debugging dead-ends and what actually worked: editor diagnostics did not detect an undefined `Router`; `node --check` from the correct `server` directory caught duplicate declarations and validated the final files.
- Techniques/patterns worth reusing: route factories construct Router/auth/cache/protect middleware; services receive repository/database dependencies and preserve transaction executors.
- Learnings consumed: none
