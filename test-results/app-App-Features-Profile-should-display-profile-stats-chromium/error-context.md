# Page snapshot

```yaml
- generic [ref=e2]:
  - img [ref=e4] [cursor=pointer]
  - heading "Sign in to The Wire" [level=1] [ref=e6]
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]: Email
      - textbox "Email" [ref=e10]:
        - /placeholder: you@example.com
        - text: chabotc@gmail.com
    - generic [ref=e11]:
      - generic [ref=e12]: Password
      - textbox "Password" [ref=e13]:
        - /placeholder: ••••••••
        - text: Rodd3n3n!
    - generic [ref=e14]: Too many requests. Please try again later.
    - button "Sign in" [ref=e15] [cursor=pointer]
  - paragraph [ref=e16]:
    - text: Don't have an account?
    - link "Sign up" [ref=e17] [cursor=pointer]:
      - /url: /signup
```