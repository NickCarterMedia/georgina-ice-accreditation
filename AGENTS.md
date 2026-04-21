# Repository Guidelines

## Project Structure & Module Organization
This repository currently centers on the static accreditation app under `accreditation/`.

- `accreditation/index.html`: landing page and route entry point
- `accreditation/admin/`: admin workflow for issuing credentials and approving media requests
- `accreditation/guard/`: QR/manual verification and zone access checks
- `accreditation/manager/`: credential-holder pass display
- `accreditation/media/`: media request intake for game, half-season, and full-season access
- `accreditation/assets/accreditation.js`: shared client-side state and business logic
- `accreditation/assets/accreditation.css`: shared styles
- `jsqr.js`: QR scanning dependency used by the guard page

## Build, Test, and Development Commands
This is a browser-first static app with no build step.

- `open accreditation/index.html`: open the app locally on macOS
- `python3 -m http.server 8000`: serve the repository for cleaner browser routing/testing
- `open http://localhost:8000/accreditation/`: open the served app

Use a local server when testing camera access, navigation between pages, or clipboard behavior.

## Coding Style & Naming Conventions
- Use 2-space indentation in HTML, CSS, and JavaScript.
- Prefer simple, framework-free JavaScript in `accreditation/assets/accreditation.js`.
- Keep new UI state centralized in shared storage keys and render functions.
- Use descriptive IDs and camelCase JS names such as `submitRequestBtn` or `renderHolderCard`.
- Keep filenames lowercase and path-based, for example `accreditation/media/index.html`.

## Testing Guidelines
There is no automated test suite yet. Validate changes manually in a browser:

- issue, suspend, revoke, and re-issue credentials
- submit and approve/reject media requests
- copy test payloads and verify on the guard page
- test restricted-area handling, escort-required flow, and expiry behavior

When adding logic, prefer functions that are easy to isolate later if automated tests are introduced.

## Commit & Pull Request Guidelines
Git history is not available in this folder, so use clear conventional-style messages:

- `feat: add media request approval workflow`
- `fix: preserve scanner checkpoint on rerender`

Pull requests should include:
- a short summary of user-facing changes
- affected paths, for example `accreditation/assets/accreditation.js`
- manual test notes
- screenshots or short screen recordings for UI changes
