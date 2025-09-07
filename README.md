# vslim-2526/backend-app

## Release process

Follow these steps:

0. Ensure all your to-be-released code be merged to `main` branch. ✅
1. Pull latest `main` branch to local machine.
2. Checkout to a new branch of `release/<version>`, eg. **release/1.0.1**
3. Update version in `package.json`, eg. **1.0.1**.
4. Commit that, then create lightweight tag for the code with `git tag <version>`, eg. **git tag 1.0.1**.
5. From CLI, run `docker build -t vslim/backend-app:<version>  -t vslim/backend-app:latest .` (notice the last dot). This will create 2 images: **vslim/backend-app:\<version\>** and **vslim/backend-app:latest**.
6. Push these 2 images to our Docker Hub repository.
7. Once done, push branch `release/\<version\>` to Github, PR to branch `main`, and get it merge.
