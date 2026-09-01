# Third-party notices

## MinerU

LivingCourse v0.3.1 supports [MinerU](https://github.com/opendatalab/MinerU) through two independent transports: the default self-hosted HTTP provider and an explicitly selected MinerU Cloud precise-API provider. MinerU is not copied or forked into this repository, and both response paths are isolated behind the LivingCourse `DocumentParsingProvider` and shared `MaterialIR` adapter boundary. Cloud behavior follows the [official API documentation](https://mineru.net/apiManage/docs); use of that hosted service remains subject to its current service terms and organizational approval.

At the time of the v0.3 review (1 September 2026), the upstream repository publishes a [MinerU Open Source License](https://github.com/opendatalab/MinerU/blob/master/LICENSE.md) based on Apache License 2.0 with additional terms. This notice records the upstream wording and does not provide a legal conclusion.

If LivingCourse later offers a third-party online service that uses MinerU, maintainers must re-check the then-current upstream license and attribution requirements before release.
