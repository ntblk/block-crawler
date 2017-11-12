# block-crawler: discovery tool for legally restricted HTTP 451 resources

## Synopsis

The _block-crawler_ module scans web resources in order to discover content withheld due to legal reasons using the HTTP 451 status code specified in [RFC7725](https://tools.ietf.org/html/rfc7725).

## Purpose and scope

Unlike other kinds of internet censorship implemented by service providers and governments, resources marked with HTTP 451 are typically blocked _at source_ — that is to say, the publisher has voluntarily complied with demands to restrict the content, either regionally or globally.

_block-crawler_ intends to provide a reference implementation for RFC7725, in so far as it covers all specified features and provisions. The tool includes specialised support for the _blocked-by_ Link HTTP header field ([RFC5988](https://tools.ietf.org/html/rfc5988)) whose value is a URI reference optionally identifying the entity which is implementing the blockage.

## Modes of operation

This module provides a standalone commandline utility as well as developer interfaces and a REST HTTP API for integration into third-party measurement frameworks.

Because HTTP 451 is typically used to 'geoblock' content, it is expected that varied results will be observed from different geographic vantage points. The output of this tool is suitable for aggregation into a larger international dataset which can reveal the global extent of corporate compliance with legal censorship orders and other kinds of localised restrictions on the flow of information online.

### Data formats

Results are produced in a simple streaming JSON annotation format which identifies the affected URL, observed status code and status text and optional blocking entity. A single report entity identifies a one HTTP request at a specific point in time observed from a single IP address.

## Installing and running it

See INSTALL.md

## Status and contributor guidelines

This tool is under development and not yet recommended for use in production.

_block-crawler_ is an Open Source project made available by the [NetBlocks.org project](https://netblocks.org) and contributors under the terms of the MIT license.
