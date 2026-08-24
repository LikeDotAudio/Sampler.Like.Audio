# Architecture_for_Blockchain.pdf

- **Source File**: `Architecture_for_Blockchain.pdf`
- **File Size**: 733858 bytes (716.66 KB)
- **Format**: .PDF

---

## Summary & Content Preview

```text
Cloud Customer Architecture for

Blockchain

Executive Overview

Blockchain technology has the potential to radically alter the way enterprises conduct business as well

as the way institutions process transactions. Businesses and governments often operate in isolation but

with blockchain technology participants can engage in business transactions with customers, suppliers,

regulators, potentially spanning across geographical boundaries.

Blockchain technology, at its core, features an immutable distributed ledger, a decentralized network

that is cryptographically secured. Blockchain architecture gives participants the ability to share a ledger,

through peer to peer replication, which is updated every time a block of transaction(s) is agreed to be

committed.

The technology can reduce operational costs and friction, create transaction records that are

immutable, and enable transparent ledgers where updates are nearly instantaneous. It may also

dramatically change the way workflow and business procedures are designed inside an enterprise and

open up new opportunities for innovation and growth.

Blockchain technology can be viewed from a business, legal and technical perspective:

•

•

•

From a business perspective, blockchain is an exchange network that facilitates transfer of

value, assets, or other entities between willing and mutually agreeing participants, ensuring

privacy and control of data to stakeholders

From a legal perspective, blockchain ledger transactions are validated, indisputable transactions,

which do not require intermediaries or trusted third-party legal entities.

From a technical perspective, blockchain is a replicated, distributed ledger of transactions with

ledger entries referencing other data stores (for additional information related to ledger

transactions). Cryptography is used to ensure that network participants see only the parts of the

ledger that are relevant to them, and that transactions are secure, authenticated and verifiable,

in the context of permissioned business blockchains.

This document will introduce basic blockchain concepts that define a standard reference architecture

that can be used in creating blockchain applications.

Blockchain Fundamentals

A blockchain is a shared ledger distributed across a business network. Business transactions are

permanently recorded in append-only blocks to the ledger. All the consensually confirmed and validated

transaction blocks are linked from the genesis block to the most current block with each block linked to

its previous block using the cryptographic hash of the previous block - hence the name blockchain.

A blockchain is a historical record of all the transactions that have taken place in the network since the

beginning of the blockchain. The blockchain serves as a single source of truth for the network.

High-level View of a Blockchain Network

Figure 1 shows the basic components that comprise a blockchain and its environment. There are many

variations on this basic conceptual design that add other features, but the diagram is a useful way to

introduce the way that blockchains work.

Figure 1: Components of a Generalized Blockchain

In general, a blockchain system consists of a number of nodes, each of which has a local copy of a

ledger. In most systems, the nodes belong to different organizations. The nodes communicate with each

other in order to gain agreement on the contents of the ledger and do not require a central authority to

coordinate and validate transactions.

The process of gaining this agreement is called consensus, and there are a number of different

algorithms that have been developed for this purpose. Users send transaction requests to the

blockchain in order to perform the operations the chain is designed to provide. Once a transaction is

completed, a record of the transaction is added to one or more of the ledgers and can never be altered

or removed. This property of the blockchain is called im
```

## Full Extracted Text

Cloud Customer Architecture for
Blockchain
Executive Overview

Blockchain technology has the potential to radically alter the way enterprises conduct business as well
as the way institutions process transactions. Businesses and governments often operate in isolation but
with blockchain technology participants can engage in business transactions with customers, suppliers,
regulators, potentially spanning across geographical boundaries.

Blockchain technology, at its core, features an immutable distributed ledger, a decentralized network
that is cryptographically secured. Blockchain architecture gives participants the ability to share a ledger,
through peer to peer replication, which is updated every time a block of transaction(s) is agreed to be
committed.
The technology can reduce operational costs and friction, create transaction records that are
immutable, and enable transparent ledgers where updates are nearly instantaneous. It may also
dramatically change the way workflow and business procedures are designed inside an enterprise and
open up new opportunities for innovation and growth.
Blockchain technology can be viewed from a business, legal and technical perspective:
•
•
•

From a business perspective, blockchain is an exchange network that facilitates transfer of
value, assets, or other entities between willing and mutually agreeing participants, ensuring
privacy and control of data to stakeholders
From a legal perspective, blockchain ledger transactions are validated, indisputable transactions,
which do not require intermediaries or trusted third-party legal entities.
From a technical perspective, blockchain is a replicated, distributed ledger of transactions with
ledger entries referencing other data stores (for additional information related to ledger
transactions). Cryptography is used to ensure that network participants see only the parts of the
ledger that are relevant to them, and that transactions are secure, authenticated and verifiable,
in the context of permissioned business blockchains.

This document will introduce basic blockchain concepts that define a standard reference architecture
that can be used in creating blockchain applications.

Blockchain Fundamentals

A blockchain is a shared ledger distributed across a business network. Business transactions are
permanently recorded in append-only blocks to the ledger. All the consensually confirmed and validated
transaction blocks are linked from the genesis block to the most current block with each block linked to
its previous block using the cryptographic hash of the previous block - hence the name blockchain.

A blockchain is a historical record of all the transactions that have taken place in the network since the
beginning of the blockchain. The blockchain serves as a single source of truth for the network.

High-level View of a Blockchain Network

Figure 1 shows the basic components that comprise a blockchain and its environment. There are many
variations on this basic conceptual design that add other features, but the diagram is a useful way to
introduce the way that blockchains work.

Figure 1: Components of a Generalized Blockchain

In general, a blockchain system consists of a number of nodes, each of which has a local copy of a
ledger. In most systems, the nodes belong to different organizations. The nodes communicate with each
other in order to gain agreement on the contents of the ledger and do not require a central authority to
coordinate and validate transactions.
The process of gaining this agreement is called consensus, and there are a number of different
algorithms that have been developed for this purpose. Users send transaction requests to the
blockchain in order to perform the operations the chain is designed to provide. Once a transaction is
completed, a record of the transaction is added to one or more of the ledgers and can never be altered
or removed. This property of the blockchain is called immutability.
Cryptography is used to secure the blockchain itself and the communications between the elements of
the blockchain system. It ensures that the ledger cannot be altered, except by the addition of new

Copyright © 2017 Cloud Standards Customer Council

Page 2

transactions. Cryptography provides integrity on messages from users or between nodes and ensures
operations are only performed by authorized entities.
The authority to perform transactions on a blockchain can use one of two models, permissioned or
permissionless. In a permissioned blockchain, users must be enrolled in the blockchain before they are
allowed to perform transactions. The enrollment process gives the user credentials that are used to
identify the user when he or she performs transactions. In a permissionless blockchain, any person can
perform transactions, but they are usually restricted from performing operations on any data but their
own.
Most business-oriented blockchains include the ability to use smart contracts, sometimes called
chaincode. A smart contract is an executable software module that is developed by the blockchain
owners, installed into the blockchain itself and enforced when pre-defined rules are met. When a user
sends a transaction to the blockchain, it can invoke a smart contract module which performs functions
defined by the creator of that module. Smart contracts usually have the ability to read and write to a
local data store which is separate from the blockchain itself and can be updated when transactions
occur. The business logic contained in a smart contract creates or operates on business data that is
contained in this persistent data store.
In a simple blockchain, every node is identical and every copy of the ledger is identical. However, more
complex blockchains allow differences in the nodes and the ledgers. Some blockchains support the
concept of subchains, which are sometimes called channels.
Subchains are logically separate chains that occupy the same physical blockchain. Each subchain may be
owned by a different entity and may be accessible to a different set of users. Nodes may be set up so
that some nodes participate in certain subchains and not in other subchains. The result of this
configuration is that the ledger on some nodes will contain transactions for that subchain while the
ledgers on other nodes will not. Another variation on the basic blockchain is one in which nodes are
assigned specific purposes instead of being identical in their function. This configuration may be used to
optimize performance since the system can be faster if every node does not have to perform every
operation required for a transaction on the chain.

Key Characteristics of a Blockchain Network

There are several characteristics that apply to Blockchain systems that affect their architecture and
implementation:
•
•
•
•
•

Cryptography: Blockchain's transactions achieve validity, trust, and finality based on
cryptographic proofs and underlying mathematical computations between various trading
partners.
Immutability: This term refers to the fact that blockchain transactions cannot be deleted or
altered.
Provenance: In a blockchain ledger, provenance is a way to trace the origin of every transaction
such that there is no dispute about the origin and sequence of the transactions in the ledger.
Decentralized computing infrastructure: These computing infrastructures feature computing
nodes that are capable of making independent processing and computational decisions
irrespective of what other peer computing nodes may decide.
Distributed transaction-processing platform: This platform handles a range of transactions,
including exchanging value, assets, or other entities.

Copyright © 2017 Cloud Standards Customer Council

Page 3

•
•

•

•

•
•

Decentralized database: Each participating partner has access to a distributed database in its
entirety at all times. No single party controls the database, which every party can verify or
regenerate if required without having a central intermediary.
Shared and distributed accounting ledger: These ledgers can be public, private, or semipublic/private. Ledgers can be shared amongst participants with privacy. In permissioned
blockchains, participants can see the transactions fully with permission and still maintain
anonymity. These transactions are final and irreversible since each transaction is linked to every
preceding transaction in the ledger. The ledger entries are time ordered and computationally
and cryptographically architected to ensure permanence, and the ledger itself is widely
replicated.
Software development platform: A software development platform makes use of APIs, peer-topeer networks, and public, private, or hybrid networks. Transactions are programmable since
the underlying ledger is digital in nature, which leads to intelligent and programmable contracts
and contract enforcements.
Cloud computing: Blockchain systems frequently involve the use of cloud computing platforms.
Cloud computing platforms offer the potential to use large amounts of resources in relation to
data storage and also the ability to bring flexible and scalable processing resources to the
analysis of data.
Peer-to-peer network: In these networks, participating nodes communicate with each other
directly and without a central or intermediate node or entity.
Wallet: A secured data store of access credentials of a user and related information, which
includes user IDs, passwords, certificates and encryption keys.

Blockchain network implementations strive for scalability and concurrency, ensure no single point of
failure, and include pluggable components like databases and other consensus mechanisms. Successful
implementations support multi-level confidentiality and privacy which is achieved through multichannel
or subchain communication, multiple sub-ledgers, and multiple stakeholders for transaction visibility
based on a need-to-know-basis.

Blockchain Reference Architecture Capabilities

Figure 2 explores the typical capabilities needed for a node or an enterprise participating in the
blockchain architecture. The reference architecture is expressed across three networks – public, cloud,
and enterprise.
While the location of capabilities in these networks is represented as a best practice, any capability can
be implemented in any network according to the needs of the blockchain solutions. While cloud
computing is not required to support blockchain platforms, services, or networks, using cloud is
recommended because of its elasticity, performance, and networking characteristics.

Copyright © 2017 Cloud Standards Customer Council

Page 4

Figure 2: Blockchain Reference Architecture Capabilities

Public Network

The Public Network contains the wide-area networks (typically the Internet), peer cloud systems, and
edge services.
Edge Services
Edge services allow data to flow safely from the Internet into the provider
cloud and into the enterprise. Edge services also support end-user
applications. Edge services include:
Domain Name System Server (DNSS) - The DNSS resolves the URL for a
particular web resource to the TCP-IP address of the system or service
that can deliver that resource.
Content Delivery Networks (CDN) - The CDNs support end-user
applications by providing geographically distributed systems of servers
deployed to minimize the response time for serving resources to
geographically distributed users. This ensures that content is highly
available and displayed to users with minimum latency. Which servers are engaged will depend on
server proximity to the user and where the content is stored or cached.
Copyright © 2017 Cloud Standards Customer Council

Page 5

Firewall - The firewall controls communication access to or from a system, permitting only traffic
meeting a set of policies to proceed and blocking any traffic that does not meet the policies. Firewalls
can be implemented as separate dedicated hardware or as a component in other networking hardware,
such as a router, or as integral software to an operating system.
Load Balancers - Load balancers distribute network or application traffic across many resources (such as
computers, processors, storage, or network links) to maximize throughput, minimize response time,
increase capacity, and increase application reliability. Load balancers can balance loads locally and
globally. They should be highly available without a single point of failure. Load balancers are sometimes
integrated as part of the provider cloud analytical system components like stream processing, data
integration, and repositories.
Users
Users are the parties of a blockchain who create and distribute
blockchain applications and perform operations using the blockchain.
These actors are consistent with the cloud computing actors and roles
from ISO/IEC ISO/IEC 17788. [1]
Users may include the following:
Developers - Blockchain developers create applications for end users (client
side) and develop smart contracts (server side) that interact with the
blockchain and are used by blockchain users to initiate transactions. They
also write code to enable the blockchain to interact with legacy applications.
Administrators - Blockchain administrators perform administrative activities related to the blockchain
network and application such as deployment and configuration of the blockchain network or
application.
Operators - Blockchain operators are responsible for defining, creating, managing, and monitoring the
blockchain network and application.
Auditors - Blockchain auditors are part of the business network and are responsible for reviewing the
blockchain transactions or access control lists and validating the integrity of those transactions from a
business, legal, audit and compliance perspective.
Business Users - Business users operate in a business network and interact with the blockchain using an
application. It is often the case that business users are not aware of the blockchain.
Now that we’ve established who is using the technology, let’s take a look at how the actors access the
blockchain platform and what components make up a blockchain platform.

Copyright © 2017 Cloud Standards Customer Council

Page 6

Cloud Network
Blockchain Applications
Blockchain applications are used to present (business) capabilities to end users of the blockchain system.
This is particularly the case for business users, where capabilities need to be presented in terms that
relate to the particular application area with concepts and processes familiar to those business users.
Applications may also exist to serve other users with different roles including administrators, operators,
and auditors.
Blockchain applications can take many forms including web applications (with code centralized on a
server closely associated with the blockchain node), or applications running on the end user device(s),
potentially connected to server-side application services.
The blockchain applications and services interface with the blo
