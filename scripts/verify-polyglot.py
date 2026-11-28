"""Cross-language contract checks against known exact values, using synthetic inputs only."""
import json
import pathlib
import subprocess
import sys
root=pathlib.Path(__file__).resolve().parents[1]
def invoke(args,source=None):
    result=subprocess.run(args,input=source,text=True,capture_output=True,check=True,cwd=root,encoding="utf-8")
    return json.loads(result.stdout)
state={"version":1,"events":[],"items":[],"stock":[],"purchases":[],"sales":[]}
plan=invoke([sys.executable,str(root/"engines/python/planner.py")],json.dumps({"state":state,"request":"payroll"}))
assert plan["mode"]=="review-only-rules" and not plan["actions"]
if "--native" in sys.argv:
    cpp=root/"engines/cpp/cost-engine"
    subprocess.run(["g++","-std=c++17","-O2",str(root/"engines/cpp/cost_engine.cpp"),"-o",str(cpp)],check=True)
    cost=invoke([str(cpp),"10001","3000","1000"])
    assert cost=={"cost":3334,"remainingValue":6667,"remainingQuantity":2000}
    huge=invoke([str(cpp),"9007199254740991","3","1"])
    assert huge["cost"]==3002399751580330
    pay=invoke(["java",str(root/"engines/java/PayrollEngine.java"),"3000000","29","30","100000","50000"])
    assert pay=={"gross":3000000,"deductions":50000,"net":2950000}
    for args in [[str(cpp),"100","0","1"],["java",str(root/"engines/java/PayrollEngine.java"),"100","31","30","0","0"]]:
        assert subprocess.run(args,capture_output=True,cwd=root).returncode!=0
print(json.dumps({"pythonPlanner":"pass","javaAndCpp":"pass" if "--native" in sys.argv else "not compiled on this host"}))
