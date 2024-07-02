# EIDA dashboard for statistics webservice

This repository hosts a UI to help users explore EIDA statistics and serves as a front-end of the corresponding statistics service.

## Steps to locally deploy this project (for development)

 - Install [Node.js](https://nodejs.org).

 - Clone the current repository and enter it:
   ```
   git clone https://github.com/EIDA/statsboard.git
   cd statsboard
   ```

 - While inside the project folder, move to application code folder:
   ```
   cd statsboard
   ```

 - Install required packages and dependencies:
   ```
   npm install
   ```

 - From now on, to run the application only below command is needed:
   ```
   npm start
   ```

 - Visit [http://localhost:3000](http://localhost:3000) to view the UI in your browser.

## Deploy in github pages

The project is currently deployed here: https://eida.github.io/statsboard/.

After pushing an update, in order to re-deploy in github pages follow below steps locally:

 - Switch to branch `github_pages`
   ```
   git checkout github_pages
   ```

 - Merge main (or the branch to which you have written your updates) to `github_pages` branch:
   ```
   git merge main
   ```

 - Deploy to github pages:
   ```
   npm run deploy -- -m "Some message describing the update (optional)"
   ```

If deployment was successful, there will be a new commit to the branch `gh_pages` and the application at https://eida.github.io/statsboard/ will be updated.

**Note:** You might need to clear your browser's cache or open a new browser to view the updates immediately.
