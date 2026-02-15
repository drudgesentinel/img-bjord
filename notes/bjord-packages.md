I'm using zod for validation.
The validation ensures a request includes ONLY specific fields.
It will also keep requests to configured lengths. This will also allow for consistent errors to handle on the frontend.

 It automatically includes the following checks:
body exists

body is a string

body is trimmed

body is not empty

subject is correct type

no extra fields (because of .strict())

