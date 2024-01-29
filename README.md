# voyager
Distributed Saturn tester as a Station module

## Development

Install [Zinnia CLI](https://github.com/filecoin-station/zinnia).

```bash
$ # Lint
$ npx standard
$ # Run module
$ zinnia run main.js
$ # Test module
$ zinnia run test.js
```

## Release

```bash
$ ./release.sh <SEMVER>
```

[Create a new release](https://github.com/filecoin-station/voyager/releases/new) for the tag you just created.
Use GitHub's changelog feature to fill out the release message.