# vslim-2526/backend-app

## Release process 🟦

Release are for the official versions, like `1.0.1`. Follow these steps:

0. Ensure all your to-be-released code be merged to `main` branch. ✅
1. Pull latest `main` branch to local machine.
2. Checkout to a new branch of `release/<version>`, eg. **release/1.0.1**
3. Update version in `package.json`, eg. **1.0.1**.
4. Commit that, then create lightweight tag for the code with `git tag <version>`, eg. **git tag 1.0.1**.
5. From CLI, run `docker build -t dongphong543/vslim-backend-app:<version>  -t dongphong543/vslim-backend-app:latest .` (notice the last dot). This will create 2 images: **dongphong543/vslim-backend-app:\<version\>** and **dongphong543/vslim-backend-app:latest**.
6. Push these 2 images to our Docker Hub repository.
7. Once done, push branch `release/<version>` to Github with `--tags` option, PR to branch `main`, and get it merge.

## Prerelease process 🟧

Release are for the testing, aka _release candidate_, versions, like `1.0.1-rc.3`. Follow these steps:

0. Checkout to a new branch of `prerelease/<future-version>-rc.<number>` from the branch of code you want to test, eg. **prerelease/1.0.1-rc.3**, as prerelease-version = 1.0.1-rc.3.
3. Update version in `package.json`, eg. **1.0.1-rc.3**.
4. Commit that, then create lightweight tag for the code with `git tag <prerelease-version>`, eg. **git tag 1.0.1-rc.3**.
5. From CLI, run `docker build -t dongphong543/vslim-backend-app:<prerelease-version> .` (notice the last dot). This will create 1 image: **dongphong543/vslim-backend-app:\<prerelease-version\>**.
6. Push this image to our Docker Hub repository.
7. Once done, push branch `prerelease/<future-version>-rc.<number>` to Github with `--tags` option, and _leave it there_.

## Deploy process ↗️
1. Access Lambda function of `vslim-deploy-image-function` with your IAM account.
2. Trigger ("Test") the function with event template `vslim-deploy-triggerer`. image_tag = your version, eg. 1.0.1, or 1.0.1-rc.
3. Wait, then check if `status = Success`. If so, then congrats, your version is deployed to production! 😀
