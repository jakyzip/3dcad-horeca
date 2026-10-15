import { addCollection, type IconifyJSON } from '@iconify/react'
import collections from './icons.json'

// Registered once, before any icon renders: @iconify/react then never asks the network for them.
for (const collection of collections as unknown as IconifyJSON[]) addCollection(collection)
