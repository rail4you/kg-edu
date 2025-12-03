import knowledge and knowledge relation use llm.

1. input is a text
2. analysis text with llm, use req_llm and openrouter model to ask llm 
3. the llm will find knowledge, subject, unit or knowledge_cells, and there relationship, export a json format.
4. elixir use this json format to create knowledge and knowledge relation, if it can create them one step successful, return a ok and the data, if failed, rollback, the whole process is transcation

5. write a script or test case to test the function
6. make a chinese example text as the demo. you can use it to the test function too